/* Peças compartilhadas entre telas que precisam de dados (fotos privadas, ações com aviso). */
import { useCallback, useState } from "react";
import { useFotoUrl } from "../../data/DadosProvider.tsx";
import { Avatar } from "../../ui/base.tsx";
import { ImagemLazy } from "../../ui/carregamento.tsx";
import { useToast } from "../../ui/feedback.tsx";

export function AvatarUsuario({ u, size = 36 }: { u: any; size?: number }) {
  const { url } = useFotoUrl(u?.foto);
  return <Avatar nome={u?.nome} url={url} size={size} />;
}

/** Foto privada: só pede a URL quando a imagem chega perto da tela. */
export function Foto({ caminho, alt = "", className = "" }: { caminho?: string | null; alt?: string; className?: string }) {
  const [ativo, setAtivo] = useState(false);
  const { url } = useFotoUrl(caminho, ativo);
  const ver = useCallback(() => setAtivo(true), []);
  return <ImagemLazy src={url} alt={alt} className={className} onVisivel={ver} />;
}

/**
 * Executa uma ação assíncrona mostrando carregamento no botão e aviso de sucesso/erro.
 * Uso: const [rodar, ocupado] = useAcao(); rodar(() => acoes.x(), "Salvo!")
 */
export function useAcao() {
  const toast = useToast();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const rodar = useCallback(
    async (
      fn: () => Promise<any>,
      sucesso?: string | ((r: any) => string) | null,
      { chave = "padrao", acao }: { chave?: string; acao?: { rotulo: string; fn: () => void } } = {},
    ) => {
      setOcupado(chave);
      try {
        const r = await fn();
        if (sucesso) toast.ok(typeof sucesso === "function" ? sucesso(r) : sucesso, { acao });
        return r;
      } catch (e) {
        toast.erro(e.message || "Algo deu errado.");
        return undefined;
      } finally {
        setOcupado(null);
      }
    },
    [toast],
  );
  return [rodar, ocupado] as const;
}
