/** Minimum 720p backing store. For viewports narrower than HD this is supersampling.
 * Lowering scene detail remains available to the frame monitor. Physical display pixels cannot be forced.
 */
export function renderScale(width,height,quality='balanced',deviceDPR=1,dynamicScale=1){
  const w=Math.max(1,width),h=Math.max(1,height);
  const cap=quality==='performance'?1.1:quality==='ultra'?2:1.5;
  const floor=w>=h?Math.max(1280/w,720/h):Math.max(720/w,1280/h);
  return Math.max(floor,Math.min(deviceDPR||1,cap)*dynamicScale);
}
