/* Reduz fotos no aparelho antes de enviar (comprovante ~100 KB em vez de vários MB). */
export function reduzirImagem(file: Blob, max = 1280, qualidade = 0.72): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não consegui ler a foto"));
    };
    img.onload = () => {
      const escala = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * escala);
      c.height = Math.round(img.height * escala);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error("Não consegui ler a foto"))), "image/jpeg", qualidade);
    };
    img.src = url;
  });
}
