/* Preferências só deste aparelho (período escolhido, avisos já vistos).
 * Nada de negócio fica aqui: se o armazenamento falhar, o app só "esquece" a preferência. */
import { useState } from "react";
import { PERIODO_PADRAO } from "../../domain/datas.ts";

export const lerLocal = (k, d) => {
  try {
    const v = localStorage.getItem(`zure:${k}`);
    return v ? JSON.parse(v) : d;
  } catch {
    return d;
  }
};

export const gravarLocal = (k, v) => {
  try {
    localStorage.setItem(`zure:${k}`, JSON.stringify(v));
  } catch {
    /* modo privado / armazenamento cheio: ignora */
  }
};

export function usePeriodo(chave) {
  const [p, setP] = useState(() => lerLocal(chave, PERIODO_PADRAO));
  const set = (v) => {
    setP(v);
    gravarLocal(chave, v);
  };
  return [p, set];
}
