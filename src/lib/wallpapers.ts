import w1 from "@/assets/wallpapers/pinheiro-luzes.jpg";
import w2 from "@/assets/wallpapers/arvore-luzes-noite.jpg";
import w3 from "@/assets/wallpapers/pinhas-canela.jpg";
import w4 from "@/assets/wallpapers/ramos-luzes.jpg";
import w5 from "@/assets/wallpapers/neve-noite.jpg";
import w6 from "@/assets/wallpapers/montanhas.jpg";
import w7 from "@/assets/wallpapers/floresta-neve.jpg";
import w8 from "@/assets/wallpapers/rasto-estrelas.jpg";
import w9 from "@/assets/wallpapers/floresta-aerea.jpg";
import w10 from "@/assets/wallpapers/caminho-aereo.jpg";
import w11 from "@/assets/wallpapers/dunas-mar.jpg";

export const wallpapers = [w1, w2, w3, w4, w5, w6, w7, w8, w9, w10, w11];

export function pickWallpaper(): string {
  return wallpapers[Math.floor(Math.random() * wallpapers.length)];
}
