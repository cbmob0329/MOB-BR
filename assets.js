// assets.js (FULL)
// 画像ロード＆プレースホルダ生成

export const ASSET_PATHS = {
  P1: 'P1.png',
  main: 'main.png',
  ido: 'ido.png',
  map: 'map.png',
  shop: 'shop.png',
  heal: 'heal.png',
  battle: 'battle.png',
  winner: 'winner.png',
};

export function loadImage(src){
  return new Promise((resolve)=>{
    const img = new Image();
    img.onload = ()=>resolve({ ok:true, img });
    img.onerror = ()=>resolve({ ok:false, img:null });
    img.src = src;
  });
}

export function makePlaceholderCanvas(label, w=512, h=512){
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');

  // BG
  ctx.fillStyle = '#141a22';
  ctx.fillRect(0,0,w,h);

  // frame
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 6;
  ctx.strokeRect(10,10,w-20,h-20);

  // stripes
  ctx.globalAlpha = 0.25;
  for(let i=-h;i<w;i+=40){
    ctx.fillStyle = (Math.floor(i/40)%2===0) ? '#2a3a4f' : '#1c2a3a';
    ctx.beginPath();
    ctx.moveTo(i,0);
    ctx.lineTo(i+30,0);
    ctx.lineTo(i+h+30,h);
    ctx.lineTo(i+h,h);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // label
  ctx.fillStyle = '#ffcc33';
  ctx.font = 'bold 34px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, w/2, h/2);

  // hint
  ctx.fillStyle = 'rgba(232,240,255,0.6)';
  ctx.font = '12px system-ui';
  ctx.fillText('(placeholder)', w/2, h/2 + 36);

  return c;
}

export async function loadAllAssets(){
  const out = {};

  for(const [key, path] of Object.entries(ASSET_PATHS)){
    const res = await loadImage(path);
    if(res.ok){
      out[key] = { type:'img', img: res.img, placeholder:false, label:key };
    }else{
      const pc = makePlaceholderCanvas(`${key}.png`, 512, 512);
      out[key] = { type:'canvas', canvas: pc, placeholder:true, label:key };
    }
  }
  return out;
}

export function drawAssetTo(ctx, asset, x, y, w, h){
  if(!asset) return;

  if(asset.type === 'img'){
    ctx.drawImage(asset.img, x, y, w, h);
    return;
  }
  if(asset.type === 'canvas'){
    ctx.drawImage(asset.canvas, x, y, w, h);
    return;
  }
}
