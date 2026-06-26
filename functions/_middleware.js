// functions/_middleware.js
export async function onRequest(context) {
  const { request, env, next } = context;
  const response = await next();
  
  // 检查返回内容是否为 HTML（根据 Content-Type）
  const contentType = response.headers.get('Content-Type') || '';
  if (!contentType.includes('text/html')) {
    return response; // 非 HTML 资源（CSS/JS/图片）直接放行
  }

  const html = await response.text();
  
  // 替换所有模板占位符
  const replaced = html
    .replace(/\{\{AMAP_KEY\}\}/g, env.AMAP_KEY || '')
    .replace(/\{\{AMAP_SECURITY_KEY\}\}/g, env.AMAP_SECURITY_KEY || '')
    .replace(/\{\{API_BASE\}\}/g, env.API_BASE || '');

  return new Response(replaced, {
    status: response.status,
    headers: response.headers,
  });
}