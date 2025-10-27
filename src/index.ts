export interface Env {
  GithubOwner: string;
  GithubRepo: string;
  GithubPAT: string;
  API_KEY: string; 
}

export default {
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { 
        status: 204,
        headers: corsHeaders
      });
    }

    if (request.method === 'POST' && new URL(request.url).pathname === '/upload') {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response('Unauthorized: Missing Bearer token', { 
          status: 401,
          headers: corsHeaders
        });
      }
      
      const apiKey = authHeader.substring('Bearer '.length);
      if (apiKey !== env.API_KEY) {
        return new Response('Unauthorized: Invalid API key', { 
          status: 401,
          headers: corsHeaders
        });
      }

      try {
        const Image: string = await request.text();
        let ImageID: string = '';
        
        for (let i = 0; i < 32; i++) {
          ImageID += String.fromCharCode(Math.floor(Math.random() * 26) + 97);
        }
        
        const base64Match = Image.match(/^data:image\/(\w+);base64,(.+)$/);
        if (!base64Match) {

          console.warn("Input is not a data URL, assuming JPEG format");
          const rawBase64 = Image.replace(/^image\/\w+;base64,/, '');
          if (!rawBase64 || rawBase64.length === 0) {
            return new Response('Invalid image data', { 
              status: 400,
              headers: corsHeaders
            });
          }
          
          const response = await fetch(`https://api.github.com/repos/${env.GithubOwner}/${env.GithubRepo}/contents/${ImageID}.webp`, {
            method: 'PUT',
            headers: {
              'Authorization': 'Bearer ' + env.GithubPAT,
              'Content-Type': 'application/json',
              'User-Agent': 'langningchen-image',
            },
            body: JSON.stringify({
              message: `Upload from ${request.headers.get('CF-Connecting-IP')} ${request.headers.get('CF-IPCountry') || 'unknown'}/${request.headers.get('CF-IPCity') || 'unknown'}`,
              content: rawBase64
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
        
        const [, imageType, ImageData] = base64Match;
        
        if (!ImageData || ImageData.length === 0) {
          return new Response('Invalid image data', { 
            status: 400,
            headers: corsHeaders
          });
        }
        
        if (!['jpeg', 'jpg', 'png', 'gif', 'webp'].includes(imageType.toLowerCase())) {
          return new Response('Unsupported image type', { 
            status: 400,
            headers: corsHeaders
          });
        }
        
        const response = await fetch(`https://api.github.com/repos/${env.GithubOwner}/${env.GithubRepo}/contents/${ImageID}.webp`, {
          method: 'PUT',
          headers: {
            'Authorization': 'Bearer ' + env.GithubPAT,
            'Content-Type': 'application/json',
            'User-Agent': 'langningchen-image',
          },
          body: JSON.stringify({
              message: `Upload from ${request.headers.get('CF-Connecting-IP')} ${request.headers.get('CF-IPCountry') || 'unknown'}/${request.headers.get('CF-IPCity') || 'unknown'}`,
            content: ImageData 
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
    
    else if (request.method === 'GET') {
      const ImageID = new URL(request.url).pathname.substring(1);
      
      if (ImageID === '') { 
        return new Response('404 Not Found', { status: 404, headers: { 'Content-Type': 'text/plain' } });
      }
      
      const clientETag = request.headers.get('If-None-Match');
      const imageETag = `"${ImageID}"`;
      
      if (clientETag === imageETag) {
        return new Response(null, { status: 304 });
      }
      
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
            'Content-Type': 'image/webp',
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