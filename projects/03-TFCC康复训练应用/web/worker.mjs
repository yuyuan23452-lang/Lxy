// The page is public; media writes require a short-lived deployment secret.
// Media is streamed from the Site's R2 bucket, including byte ranges for seeking.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const key = url.pathname.slice(1);
    if (key.startsWith('_media/')) {
      if (!env.MEDIA_UPLOAD_TOKEN || request.headers.get('Authorization') !== `Bearer ${env.MEDIA_UPLOAD_TOKEN}`) return new Response('Not found',{status:404});
      const name = key.slice(7);
      if (!MEDIA_NAMES.includes(name)) return new Response('Not found',{status:404});
      try {
        if (request.method === 'POST' && url.searchParams.get('action') === 'init') {
          const body = await request.json();
          if (!/^[a-f0-9]{64}$/.test(body.sha256)) return new Response('Invalid checksum',{status:400});
          const upload = await env.BUCKET.createMultipartUpload(name,{
            httpMetadata:{contentType:name.endsWith('.mp4')?'video/mp4':'image/png',cacheControl:'public, max-age=86400'},
            customMetadata:{sha256:body.sha256}
          });
          return Response.json({uploadId:upload.uploadId});
        }
        const uploadId = url.searchParams.get('uploadId');
        if (!uploadId) return new Response('Missing upload id',{status:400});
        const upload = env.BUCKET.resumeMultipartUpload(name,uploadId);
        if (request.method === 'PUT') {
          const part = Number(url.searchParams.get('part'));
          if (!Number.isInteger(part) || part < 1 || part > 10000) return new Response('Invalid part',{status:400});
          return Response.json(await upload.uploadPart(part,request.body));
        }
        if (request.method === 'POST' && url.searchParams.get('action') === 'complete') {
          const {parts} = await request.json();
          const object = await upload.complete(parts);
          return Response.json({size:object.size,etag:object.etag});
        }
        if (request.method === 'DELETE') {await upload.abort();return new Response(null,{status:204});}
        return new Response('Method not allowed',{status:405});
      } catch (error) { console.error('Media upload failed',error);return new Response('Media upload unavailable',{status:503}); }
    }
    if (!['GET','HEAD'].includes(request.method)) return new Response('Method not allowed',{status:405});
    const asset = STATIC_ASSETS[key || 'index.html'];
    if (asset) return new Response(request.method === 'HEAD'?null:asset.body,{headers:{'Content-Type':asset.type,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
    if (!MEDIA_NAMES.includes(key)) return new Response('Not found',{status:404});
    try {
      const metadata=await env.BUCKET.head(key);
      if (!metadata) return new Response('Media unavailable',{status:404,headers:{'Cache-Control':'no-store'}});
      const headers=new Headers(); metadata.writeHttpMetadata(headers);
      headers.set('Accept-Ranges','bytes');headers.set('ETag',metadata.httpEtag);
      headers.set('X-Content-SHA256',metadata.customMetadata?.sha256 || '');
      headers.set('X-Content-Type-Options','nosniff');
      let range=null;
      if (request.headers.has('Range') && (!request.headers.has('If-Range') || request.headers.get('If-Range')===metadata.httpEtag)) {
        const match=/^bytes=(\d*)-(\d*)$/.exec(request.headers.get('Range'));
        if (!match || (!match[1]&&!match[2])) return new Response(null,{status:416,headers:{'Content-Range':`bytes */${metadata.size}`}});
        const start=match[1]?Number(match[1]):Math.max(0,metadata.size-Number(match[2]));
        const end=match[1]&&match[2]?Math.min(metadata.size-1,Number(match[2])):metadata.size-1;
        if (!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=metadata.size) return new Response(null,{status:416,headers:{'Content-Range':`bytes */${metadata.size}`}});
        range={offset:start,length:end-start+1};
        headers.set('Content-Range',`bytes ${start}-${end}/${metadata.size}`);
      }
      headers.set('Content-Length',String(range?range.length:metadata.size));
      if (request.method==='HEAD') return new Response(null,{status:range?206:200,headers});
      const object=await env.BUCKET.get(key,range?{range}:{});
      if(!object) return new Response('Media unavailable',{status:404});
      return new Response(object.body,{status:range?206:200,headers});
    } catch(error) {console.error('Media read failed',error);return new Response('Media temporarily unavailable',{status:503,headers:{'Cache-Control':'no-store'}});}
  }
};
