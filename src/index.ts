export interface Env {
  GithubOwner: string;
  GithubRepo: string;
  GithubPAT: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    // Add CORS headers for all responses
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { 
        status: 204,
        headers: corsHeaders
      });
    }

    // Handle image upload
    if (request.method === 'POST' && new URL(request.url).pathname === '/upload') {
      try {
        const Image: string = await request.text();
        let ImageID: string = '';
        
        // Generate random ID
        for (let i = 0; i < 32; i++) {
          ImageID += String.fromCharCode(Math.floor(Math.random() * 26) + 97);
        }
        
        // Validate and extract base64 data
        // This regex now matches any image type (jpeg, png, gif, webp, etc.)
        const base64Match = Image.match(/^data:image\/(\w+);base64,(.+)$/);
        if (!base64Match) {
          // If it's not a data URL, assume it's raw base64 (as in your original worker)
          // and treat it as JPEG for backward compatibility
          console.warn("Input is not a data URL, assuming JPEG format");
          const rawBase64 = Image.replace(/^data:image\/\w+;base64,/, '');
          if (!rawBase64 || rawBase64.length === 0) {
            return new Response('Invalid image data', { 
              status: 400,
              headers: corsHeaders
            });
          }
          
          // For true WebP conversion in a Worker, we need to use a library or service
          // Since we can't easily do this in a basic Worker, we'll store the original data
          // but with a .webp extension. The client should ideally send WebP.
          // For this example, we'll just use the raw data as is.
          const response = await fetch(`https://api.github.com/repos/${env.GithubOwner}/${env.GithubRepo}/contents/${ImageID}.webp`, {
            method: 'PUT',
            headers: {
              'Authorization': 'Bearer ' + env.GithubPAT,
              'Content-Type': 'application/json',
              'User-Agent': 'langningchen-image',
            },
            body: JSON.stringify({
              message: `Upload from ${request.headers.get('CF-Connecting-IP')} ${request.headers.get('CF-IPCountry')}`,
              content: rawBase64 // Use the raw base64 data
            })
          });
          
          if (!response.ok) {
            console.error('GitHub API error:', response.status, await response.text());
            return new Response('Upload failed', { 
              status: 500,
              headers: corsHeaders
            });
          }
          
          const jsonResponse = await response.json();
          if (!jsonResponse.content || jsonResponse.content.name !== `${ImageID}.webp`) {
            console.log('Unexpected response:', jsonResponse);
            return new Response('Upload failed', { 
              status: 500,
              headers: corsHeaders
            });
          }
          
          return new Response(ImageID, { 
            headers: { 
              'Content-Type': 'text/plain',
              ...corsHeaders
            }
          });
        }
        
        // If it is a data URL, extract type and data
        const [, imageType, ImageData] = base64Match;
        
        // Validate base64 data
        if (!ImageData || ImageData.length === 0) {
          return new Response('Invalid image data', { 
            status: 400,
            headers: corsHeaders
          });
        }
        
        // Validate image type (optional, but good for security)
        if (!['jpeg', 'jpg', 'png', 'gif', 'webp'].includes(imageType.toLowerCase())) {
          return new Response('Unsupported image type', { 
            status: 400,
            headers: corsHeaders
          });
        }
        
        // For true WebP conversion in a Worker, we need to use a library or service
        // Since we can't easily do this in a basic Worker, we'll store the original data
        // but with a .webp extension. The client should ideally send WebP.
        // For this example, we'll just use the extracted base64 data as is.
        const response = await fetch(`https://api.github.com/repos/${env.GithubOwner}/${env.GithubRepo}/contents/${ImageID}.webp`, {
          method: 'PUT',
          headers: {
            'Authorization': 'Bearer ' + env.GithubPAT,
            'Content-Type': 'application/json',
            'User-Agent': 'langningchen-image',
          },
          body: JSON.stringify({
            message: `Upload from ${request.headers.get('CF-Connecting-IP')} ${request.headers.get('CF-IPCountry')}`,
            content: ImageData // Use the extracted base64 data
          })
        });
        
        if (!response.ok) {
          console.error('GitHub API error:', response.status, await response.text());
          return new Response('Upload failed', { 
            status: 500,
            headers: corsHeaders
          });
        }
        
        const jsonResponse = await response.json();
        if (!jsonResponse.content || jsonResponse.content.name !== `${ImageID}.webp`) {
          console.log('Unexpected response:', jsonResponse);
          return new Response('Upload failed', { 
            status: 500,
            headers: corsHeaders
          });
        }
        
        return new Response(ImageID, { 
          headers: { 
            'Content-Type': 'text/plain',
            ...corsHeaders
          }
        });
      } catch (error) {
        console.error('Upload error:', error);
        return new Response('Upload failed', { 
          status: 500,
          headers: corsHeaders
        });
      }
    }
    
    // Handle image retrieval
    else if (request.method === 'GET') {
      const ImageID = new URL(request.url).pathname.substring(1);
      
      if (ImageID === '') { 
        return new Response('404 Not Found', { status: 404, headers: { 'Content-Type': 'text/plain' } });
      }
      
      // Check if client has cached version using ETag
      const clientETag = request.headers.get('If-None-Match');
      const imageETag = `"${ImageID}"`;
      
      if (clientETag === imageETag) {
        return new Response(null, { status: 304 });
      }
      
      // Always try to get the image as WebP
      const githubUrl = `https://api.github.com/repos/${env.GithubOwner}/${env.GithubRepo}/contents/${ImageID}.webp?1=1`;
      
      try {
        const res = await fetch(githubUrl, {
          method: 'GET',
          headers: {
            'Authorization': 'Bearer ' + env.GithubPAT,
            'Accept': 'application/vnd.github.v3.raw',
            'User-Agent': 'langningchen-image',
          },
        });

        if (!res.ok) {
          return new Response('Image not found', { status: 404, headers: { 'Content-Type': 'text/plain' } });
        }

        const imageBuffer = await res.arrayBuffer();
        
        return new Response(imageBuffer, { 
          headers: { 
            'Content-Type': 'image/webp', // Always serve as WebP
            'Cache-Control': 'public, max-age=31536000, immutable',
            'ETag': imageETag,
            'Last-Modified': new Date().toUTCString(),
            'Accept-Ranges': 'bytes',
            'X-Content-Type-Options': 'nosniff',
            ...corsHeaders
          }, 
        });
      } catch (error) {
        console.error('Fetch error:', error);
        return new Response('Image not found', { status: 404, headers: { 'Content-Type': 'text/plain' } });
      }
    }
    
    return new Response('404 Not Found', { status: 404, headers: { 'Content-Type': 'text/plain' } });
  },
};