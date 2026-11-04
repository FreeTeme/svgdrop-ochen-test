// Keep the opposite corner fixed while resizing in the object's rotated axes.
export function resizeFromCorner(layer,corner,point){
 const sx=corner.endsWith('e')?1:-1,sy=corner.startsWith('s')?1:-1;
 const angle=layer.rotation*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
 const ax=layer.x-c*sx*layer.w/2+s*sy*layer.h/2;
 const ay=layer.y-s*sx*layer.w/2-c*sy*layer.h/2;
 const dx=point.x-ax,dy=point.y-ay;
 const vx=c*dx+s*dy,vy=-s*dx+c*dy;
 const factor=Math.max(20/layer.w,Math.min(4000/layer.w,(vx*sx*layer.w+vy*sy*layer.h)/(layer.w**2+layer.h**2)));
 const w=layer.w*factor,h=layer.h*factor;
 return {w,h,x:ax+c*sx*w/2-s*sy*h/2,y:ay+s*sx*w/2+c*sy*h/2};
}
export function rotationFromPointer(layer,start,point,snap=false){
 const a=Math.atan2(start.y-layer.y,start.x-layer.x),b=Math.atan2(point.y-layer.y,point.x-layer.x);
 let value=layer.rotation+(b-a)*180/Math.PI;if(snap)value=Math.round(value/15)*15;
 return ((value+180)%360+360)%360-180;
}
