import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { MotionGlobalConfig } from "framer-motion";
import { afterEach, vi } from "vitest";

afterEach(() => cleanup());
// Telas carregadas sob demanda (lazy) podem levar alguns segundos no jsdom.
configure({ asyncUtilTimeout: 15000 });

// jsdom não implementa estes recursos de navegador usados pela interface.
if (!window.matchMedia)
  window.matchMedia = (q: string) =>
    ({
      matches: false,
      media: q,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
Element.prototype.scrollIntoView = vi.fn();
class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = window.ResizeObserver || (RO as unknown as typeof ResizeObserver);
if (!URL.createObjectURL) URL.createObjectURL = () => "blob:teste";

// Relógio fixo numa quarta às 15h: nada que depende de horário (resumo das 19h, ponto) muda o teste.
vi.useFakeTimers({ toFake: ["Date"], shouldAdvanceTime: true });
vi.setSystemTime(new Date(2026, 9, 7, 15, 0));

// Nos testes as animações terminam na hora (o comportamento é o mesmo, sem esperar transições).
MotionGlobalConfig.skipAnimations = true;
