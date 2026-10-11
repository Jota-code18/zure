/* Se algo quebrar na tela, mostra uma saída amigável e reporta para a observabilidade. */
import { Component, type ReactNode } from "react";
import { reportarErro } from "../observability/index.ts";
import { GOLD } from "../ui/tema.ts";

export class ErroBoundary extends Component<{ children?: ReactNode }, { erro: unknown }> {
  state = { erro: null };

  static getDerivedStateFromError(erro) {
    return { erro };
  }

  componentDidCatch(erro, info) {
    reportarErro(erro, { componente: info?.componentStack?.slice(0, 500) });
  }

  render() {
    if (!this.state.erro) return this.props.children;
    return (
      <div role="alert" className="min-h-dvh flex flex-col items-center justify-center gap-4 p-6 text-center bg-[#0A0A0A] text-white">
        <h1 className="text-xl font-black">Algo deu errado nesta tela.</h1>
        <p className="text-sm text-neutral-400 max-w-sm">Seus dados estão salvos no banco. Recarregue para continuar; o problema já foi registrado.</p>
        <button type="button" onClick={() => window.location.reload()} className="px-5 py-3 rounded-xl font-bold text-black" style={{ background: GOLD }}>
          Recarregar
        </button>
      </div>
    );
  }
}
