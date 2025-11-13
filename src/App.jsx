import { useEffect, useState } from "react";
import { PlusCircle, Trash2, Edit2, Download, Paperclip } from "lucide-react";
import * as XLSX from "xlsx";

export default function App() {
  const [protocols, setProtocols] = useState([]);
  const [filteredProtocols, setFilteredProtocols] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editProtocol, setEditProtocol] = useState(null);
  const [newProtocol, setNewProtocol] = useState({
    email_cliente: "",
    assunto_original: "",
    status_processo: "Em andamento",
    responsavel: "",
    aprovacao_orcamento: "",
    confirmacao_cliente: "",
    detalhes: "",
    attachments: [],
  });
  const [notifications, setNotifications] = useState([]);

  // Carrega protocolos do localStorage
  useEffect(() => {
    const saved = localStorage.getItem("protocolos");
    if (saved) {
      const parsed = JSON.parse(saved);
      setProtocols(parsed);
      setFilteredProtocols(parsed);
    }
  }, []);

  // Salva no localStorage
  const saveProtocols = (data) => {
    setProtocols(data);
    setFilteredProtocols(data);
    localStorage.setItem("protocolos", JSON.stringify(data));
  };

  // Filtragem de protocolos
  useEffect(() => {
    const filtered = protocols.filter((p) =>
      Object.values(p).some((v) =>
        String(v).toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
    setFilteredProtocols(filtered);
  }, [searchTerm, protocols]);

  // Notificação visual
  const addNotification = (text) => {
    const id = Date.now();
    setNotifications((prev) => [...prev, { id, text }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 4000);
  };

  // Adicionar protocolo
  const addProtocol = () => {
    if (!newProtocol.email_cliente || !newProtocol.assunto_original) {
      addNotification("Preencha os campos obrigatórios!");
      return;
    }

    const newEntry = {
      ...newProtocol,
      id_protocolo: Math.floor(Math.random() * 100000),
      data_entrada: new Date().toISOString(),
      data_ultima_atualizacao: new Date().toISOString(),
    };

    const updated = [newEntry, ...protocols];
    saveProtocols(updated);

    setNewProtocol({
      email_cliente: "",
      assunto_original: "",
      status_processo: "Em andamento",
      responsavel: "",
      aprovacao_orcamento: "",
      confirmacao_cliente: "",
      detalhes: "",
      attachments: [],
    });
    setShowModal(false);
    addNotification("Protocolo criado com sucesso!");
  };

  // Excluir protocolo
  const deleteProtocol = (id) => {
    const confirmDelete = window.confirm(
      "Tem certeza que deseja excluir este protocolo?"
    );
    if (!confirmDelete) return;

    const updated = protocols.filter((p) => p.id_protocolo !== id);
    saveProtocols(updated);
    addNotification(`Protocolo ${id} excluído com sucesso!`);
  };

  // Abrir modal de edição
  const openEditModal = (protocol) => {
    setEditProtocol({ ...protocol });
    setShowEditModal(true);
  };

  // Salvar alterações
  const saveEditedProtocol = () => {
    const updated = protocols.map((p) =>
      p.id_protocolo === editProtocol.id_protocolo ? editProtocol : p
    );

    saveProtocols(updated);
    addNotification(`Protocolo ${editProtocol.id_protocolo} atualizado!`);
    setShowEditModal(false);
    setEditProtocol(null);
  };

  // Exportar XLSX
  const exportToXLSX = async () => {
    const headers = [
      "ID Protocolo",
      "Data de Entrada",
      "E-mail do Cliente",
      "Assunto",
      "Status do Processo",
      "Responsável",
      "Aprovação Orçamento",
      "Confirmação Cliente",
      "Última Atualização",
      "Detalhes",
      "Anexos",
    ];

    const rows = filteredProtocols.map((p) => [
      p.id_protocolo,
      new Date(p.data_entrada).toLocaleString("pt-BR"),
      p.email_cliente,
      p.assunto_original,
      p.status_processo,
      p.responsavel,
      p.aprovacao_orcamento,
      p.confirmacao_cliente,
      new Date(p.data_ultima_atualizacao).toLocaleString("pt-BR"),
      p.detalhes || "",
      p.attachments && p.attachments.length > 0
        ? p.attachments.map((a) => a.name).join(", ")
        : "",
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Protocolos");

    XLSX.writeFile(
      workbook,
      `protocolos_${new Date().toISOString().split("T")[0]}.xlsx`
    );

    addNotification("Planilha XLSX exportada com sucesso!");
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-8">
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">📂 Sistema de Gestão de Protocolos</h1>
        <div className="flex gap-4">
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl hover:from-amber-600 hover:to-orange-700 transition-all shadow-lg"
          >
            <PlusCircle className="w-5 h-5" />
            Novo Protocolo
          </button>
          <button
            onClick={exportToXLSX}
            className="flex items-center gap-2 px-6 py-3 border border-slate-300 rounded-xl bg-white hover:bg-slate-100 transition-all"
          >
            <Download className="w-5 h-5" />
            Exportar XLSX
          </button>
        </div>
      </header>

      <div className="mb-6">
        <input
          type="text"
          placeholder="🔍 Buscar protocolo..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500"
        />
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto bg-white rounded-xl shadow-md border border-slate-200">
        <table className="min-w-full border-collapse">
          <thead className="bg-slate-100 text-slate-700 font-semibold">
            <tr>
              <th className="p-3 text-left">ID</th>
              <th className="p-3 text-left">E-mail</th>
              <th className="p-3 text-left">Assunto</th>
              <th className="p-3 text-left">Responsável</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Anexos</th>
              <th className="p-3 text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredProtocols.length > 0 ? (
              filteredProtocols.map((protocol) => (
                <tr
                  key={protocol.id_protocolo}
                  className="border-t border-slate-200 hover:bg-slate-50"
                >
                  <td className="p-3">{protocol.id_protocolo}</td>
                  <td className="p-3">{protocol.email_cliente}</td>
                  <td className="p-3">{protocol.assunto_original}</td>
                  <td className="p-3">{protocol.responsavel}</td>
                  <td className="p-3">{protocol.status_processo}</td>
                  <td className="p-3">
                    {protocol.attachments && protocol.attachments.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        {protocol.attachments.map((att) => (
                          <a
                            key={att.id}
                            href={URL.createObjectURL(
                              new Blob([att.file], { type: att.type })
                            )}
                            download={att.name}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                          >
                            <Paperclip className="w-3 h-3" /> {att.name}
                          </a>
                        ))}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="p-3 flex justify-center gap-3">
                    <button
                      onClick={() => openEditModal(protocol)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => deleteProtocol(protocol.id_protocolo)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan="7"
                  className="text-center py-6 text-slate-500 italic"
                >
                  Nenhum protocolo encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 🔔 Notificações */}
      <div className="fixed bottom-5 right-5 flex flex-col gap-2 z-50">
        {notifications.map((n) => (
          <div
            key={n.id}
            className="bg-green-500 text-white px-4 py-2 rounded-lg shadow-md animate-fade-in"
          >
            {n.text}
          </div>
        ))}
      </div>

      {/* 🟢 Modal de criação */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40">
          <div className="bg-white w-[600px] rounded-xl shadow-lg overflow-hidden">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-2xl font-bold">Novo Protocolo</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-500 hover:text-slate-800 text-xl"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <input
                type="email"
                placeholder="E-mail do cliente"
                value={newProtocol.email_cliente}
                onChange={(e) =>
                  setNewProtocol({ ...newProtocol, email_cliente: e.target.value })
                }
                className="w-full px-4 py-3 border border-slate-300 rounded-xl"
              />
              <input
                type="text"
                placeholder="Assunto"
                value={newProtocol.assunto_original}
                onChange={(e) =>
                  setNewProtocol({
                    ...newProtocol,
                    assunto_original: e.target.value,
                  })
                }
                className="w-full px-4 py-3 border border-slate-300 rounded-xl"
              />
              <textarea
                placeholder="Detalhes"
                value={newProtocol.detalhes}
                onChange={(e) =>
                  setNewProtocol({ ...newProtocol, detalhes: e.target.value })
                }
                className="w-full px-4 py-3 border border-slate-300 rounded-xl"
                rows="4"
              />
              <input
                type="file"
                multiple
                onChange={(e) =>
                  setNewProtocol({
                    ...newProtocol,
                    attachments: Array.from(e.target.files).map((file) => ({
                      id: Math.random(),
                      name: file.name,
                      type: file.type,
                      file,
                    })),
                  })
                }
                className="w-full border border-slate-300 rounded-xl px-4 py-3"
              />
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3 bg-slate-50">
              <button
                onClick={() => setShowModal(false)}
                className="px-6 py-3 border-2 border-slate-300 rounded-xl hover:bg-white transition-all font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={addProtocol}
                className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl hover:from-amber-600 hover:to-orange-700 transition-all font-semibold shadow-lg"
              >
                Criar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✏️ Modal de edição */}
      {showEditModal && editProtocol && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40">
          <div className="bg-white w-[600px] rounded-xl shadow-lg overflow-hidden">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <Edit2 className="w-6 h-6" />
                Editar Protocolo {editProtocol.id_protocolo}
              </h2>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    E-mail do Cliente
                  </label>
                  <input
                    type="email"
                    value={editProtocol.email_cliente}
                    onChange={(e) =>
                      setEditProtocol({
                        ...editProtocol,
                        email_cliente: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Assunto
                  </label>
                  <input
                    type="text"
                    value={editProtocol.assunto_original}
                    onChange={(e) =>
                      setEditProtocol({
                        ...editProtocol,
                        assunto_original: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Responsável
                  </label>
                  <input
                    type="text"
                    value={editProtocol.responsavel}
                    onChange={(e) =>
                      setEditProtocol({
                        ...editProtocol,
                        responsavel: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Detalhes
                  </label>
                  <textarea
                    value={editProtocol.detalhes}
                    onChange={(e) =>
                      setEditProtocol({
                        ...editProtocol,
                        detalhes: e.target.value,
                      })
                    }
                    rows="4"
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex justify-end gap-3 bg-slate-50">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditProtocol(null);
                }}
                className="px-6 py-3 border-2 border-slate-300 rounded-xl hover:bg-white font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={saveEditedProtocol}
                className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl hover:from-amber-600 hover:to-orange-700 font-semibold shadow-lg"
              >
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProtocolManagementSystem;
