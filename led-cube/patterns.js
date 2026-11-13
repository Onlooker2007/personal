export const effects = ['Sine wave', 'Double helix', 'Light rain', 'Radial pulse', 'Plane scan', 'Vortex', 'Stardust', 'All lights'];
const TAU = Math.PI * 2;
const gauss = (d, width = .7) => Math.exp(-d * d / width);
const fract = n => n - Math.floor(n);
export function intensity(mode, x, y, z, t) {
  switch (mode) {
    case 0: return gauss(y - 1.9 * Math.sin(x * .75 + z * .55 - t * 1.8), .65);
    case 1: {
      const angle = y * .85 - t * 1.6;
      const a = Math.hypot(x - 2 * Math.cos(angle), z - 2 * Math.sin(angle));
      const b = Math.hypot(x + 2 * Math.cos(angle), z + 2 * Math.sin(angle));
      return gauss(Math.min(a,b), .85);
    }
    case 2: {
      const seed = fract(Math.sin((x+3)*127.1+(z+3)*311.7)*43758.5453);
      const head = 3.5 - fract(t * (.32 + seed * .2) + seed) * 8;
      const d = y - head;
      return d >= 0 ? Math.exp(-d * 1.35) : gauss(d, .13);
    }
    case 3: return gauss(Math.hypot(x,y,z) - (t * 1.7 % 5.8), .34);
    case 4: return gauss(x*Math.cos(t*.35)+z*Math.sin(t*.35)+y*.4-3.6*Math.sin(t*1.1), .36);
    case 5: {
      const r = Math.hypot(x,z);
      const a = Math.atan2(z,x) + t * 1.8 - y * .75 - r * .8;
      return Math.pow(.5 + .5 * Math.cos(a * 2), 10) * (.45 + .55 * gauss(r-2,.9));
    }
    case 6: {
      const seed = fract(Math.sin(x*91.7+y*53.1+z*17.3)*43758.5453);
      return Math.pow(.5+.5*Math.sin(t*(1.1+seed*2.2)+seed*TAU), 16);
    }
    case 7: return .82 + .18 * Math.sin(t * 1.6);
    default: return 0;
  }
}
