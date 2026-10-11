/* Traduz erros do banco/rede para mensagens que o barbeiro entende. */

const CODIGOS = {
  SEM_PERMISSAO: "Você não tem permissão para isso.",
  BARBEIRO_INVALIDO: "Barbeiro inválido ou inativo.",
  FIADO_SEM_CLIENTE: "Fiado precisa de cliente.",
  LANCAMENTO_SEM_ITENS: "Escolha pelo menos um serviço ou produto.",
  ITEM_INVALIDO: "Algum item da comanda está inválido.",
  PAGAMENTO_INVALIDO: "Forma de pagamento inválida.",
  PAGAMENTO_NAO_BATE: "A soma dos pagamentos não bate com o total.",
  LANCAMENTO_NAO_ENCONTRADO: "Lançamento não encontrado (talvez já tenha sido apagado).",
  LANCAMENTO_EXCLUIDO: "Esse lançamento foi excluído. Restaure antes de editar.",
  FIADO_NAO_ENCONTRADO: "Esse fiado já foi pago ou não existe mais.",
  QUANTIDADE_INVALIDA: "Quantidade inválida.",
  PRODUTO_NAO_ENCONTRADO: "Produto não encontrado.",
  CADASTRO_NAO_AUTORIZADO: "Esse e-mail não foi convidado. Peça ao dono para cadastrar você em Ajustes › Equipe.",
};

export class ErroApp extends Error {
  codigo?: string;
  cause?: unknown;
  constructor(mensagem: string, { causa, codigo }: { causa?: unknown; codigo?: string } = {}) {
    super(mensagem);
    this.name = "ErroApp";
    this.codigo = codigo;
    this.cause = causa;
  }
}

export function traduzirErro(e) {
  if (e instanceof ErroApp) return e;
  const texto = `${e?.message || ""} ${e?.details || ""} ${e?.hint || ""}`;
  for (const [codigo, msg] of Object.entries(CODIGOS)) if (texto.includes(codigo)) return new ErroApp(msg, { causa: e, codigo });
  if (/Database error saving new user/i.test(texto)) return new ErroApp(CODIGOS.CADASTRO_NAO_AUTORIZADO, { causa: e, codigo: "CADASTRO_NAO_AUTORIZADO" });
  if (/Invalid login credentials/i.test(texto)) return new ErroApp("E-mail ou senha incorretos.", { causa: e, codigo: "LOGIN" });
  if (/Email not confirmed/i.test(texto)) return new ErroApp("Confirme seu e-mail pelo link que enviamos antes de entrar.", { causa: e, codigo: "EMAIL" });
  if (/User already registered/i.test(texto))
    return new ErroApp("Esse e-mail já tem conta. Use “Entrar” ou “Esqueci a senha”.", { causa: e, codigo: "JA_EXISTE" });
  if (/Password should be/i.test(texto)) return new ErroApp("A senha precisa ter pelo menos 6 caracteres.", { causa: e, codigo: "SENHA" });
  if (/rate limit/i.test(texto)) return new ErroApp("Muitas tentativas. Espere alguns minutos e tente de novo.", { causa: e, codigo: "LIMITE" });
  if (/duplicate key/i.test(texto)) return new ErroApp("Isso já foi registrado.", { causa: e, codigo: "DUPLICADO" });
  if (/Failed to fetch|NetworkError|network/i.test(texto))
    return new ErroApp("Sem conexão com a internet. Nada foi perdido: tente de novo.", { causa: e, codigo: "REDE" });
  return new ErroApp("Algo deu errado. Tente de novo.", { causa: e, codigo: "DESCONHECIDO" });
}
