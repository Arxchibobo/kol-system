export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // 将 myshell.site 的流量“搬运”到 Google Cloud Run
    // 请确保这里的 run.app 地址是您最新的地址
    url.hostname = 'myshell-affiliate-center-907292327180.us-west1.run.app';
    
    // 创建新请求，自动设置 Host 头，骗过 Google Cloud 的验证
    const newRequest = new Request(url, request);
    
    return fetch(newRequest);
  },
};