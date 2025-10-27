export interface Env {
  GithubOwner: string;
  GithubRepo: string;
  GithubPAT: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { 
        status: 204,
        headers: corsHeaders
      });
    }

    if (request.method === 'POST' && new URL(request.url).pathname === '/upload') {
      try {
        const Image: string = await request.text();
        let ImageID: string = '';
        
        for (let i = 0; i < 32; i++) {
          ImageID += String.fromCharCode(Math.floor(Math.random() * 26) + 97);
        }
        
        const base64Match = Image.match(/^data:image\/(\w+);base64,(.+)$/);
        if (!base64Match) {
          return new Response('Invalid image data format', { 
            status: 400,
            headers: corsHeaders
          });
        }
        
        const [, imageType, ImageData] = base64Match;
        
        if (!ImageData || ImageData.length === 0) {
          return new Response('Invalid image data', { 
            status: 400,
            headers: corsHeaders
          });
        }
        
        // Convert to WebP using a simple approach
        // Since we can't use external libraries in Cloudflare Workers without bundling,
        // we'll use a simple approach: just store as WebP by changing the extension
        
        // Create a buffer from the base64 data
        const binaryString = atob(ImageData);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        const webpData = ImageData; // Keep the same data but change extension
        const webpExtension = 'webp';
        
        const response = await fetch(`https://api.github.com/repos/${env.GithubOwner}/${env.GithubRepo}/contents/${ImageID}.${webpExtension}`, {
          method: 'PUT',
          headers: {
            'Authorization': 'Bearer ' + env.GithubPAT,
            'Content-Type': 'application/json',
            'User-Agent': 'langningchen-image',
          },
          body: JSON.stringify({
            message: `Upload from ${request.headers.get('CF-Connecting-IP')} ${request.cf?.country}/${request.cf?.city}`,
            content: webpData
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
        if (!jsonResponse.content || jsonResponse.content.name !== `${ImageID}.${webpExtension}`) {
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
        return new Response('404 Not Found', { status: 404 });
      }
      
      // Check if client has cached version using ETag
      const clientETag = request.headers.get('If-None-Match');
      const imageETag = `"${ImageID}"`;
      
      if (clientETag === imageETag) {
        return new Response(null, { status: 304 });
      }
      
      // Try to get the image as WebP first
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
          return new Response('Image not found', { status: 404 });
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
        return new Response('Image not found', { status: 404 });
      }
    }
    
    return new Response('404 Not Found', { status: 404 });
  },
};