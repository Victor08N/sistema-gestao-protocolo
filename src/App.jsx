import React, { useState, useEffect } from 'react';
import { Search, Plus, Mail, CheckCircle, Clock, Package, AlertCircle, Download, Edit2, Trash2, Paperclip, FileText, X, Save } from 'lucide-react';
import * as XLSX from 'xlsx';

const ProtocolManagementSystem = () => {
  const [protocols, setProtocols] = useState([]);
  const [filteredProtocols, setFilteredProtocols] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const [showNewProtocolModal, setShowNewProtocolModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedProtocol, setSelectedProtocol] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [attachments, setAttachments] = useState([]);

  const [newProtocol, setNewProtocol] = useState({
    email_cliente: '',
    assunto_original: '',
    detalhes: '',
    responsavel: ''
  });

  const [editProtocol, setEditProtocol] = useState(null);

  useEffect(() => {
    loadProtocols();
  }, []);

  useEffect(() => {
    let filtered = protocols;

    if (statusFilter !== 'TODOS') {
      filtered = filtered.filter(p => p.status_processo === statusFilter);
    }

    if (searchTerm) {
      filtered = filtered.filter(p => 
        p.id_protocolo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.email_cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.assunto_original.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredProtocols(filtered);
  }, [protocols, statusFilter, searchTerm]);

  const loadProtocols = () => {
    try {
      const stored = localStorage.getItem('protocols-data');
      if (stored) {
        setProtocols(JSON.parse(stored));
      }
    } catch (error) {
      console.log('Nenhum dado anterior encontrado');
    }
  };

  const saveProtocols = (updatedProtocols) => {
    try {
      localStorage.setItem('protocols-data', JSON.stringify(updatedProtocols));
      setProtocols(updatedProtocols);
    } catch (error) {
      addNotification('Erro ao salvar dados', 'error');
    }
  };

  const generateProtocolId = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const seq = String(protocols.length + 1).padStart(3, '0');
    return `${year}${month}${day}-${seq}`;
  };

  const addNotification = (message, type = 'success') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4000);
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    const newAttachments = files.map(file => ({
      id: Date.now() + Math.random(),
      name: file.name,
      size: (file.size / 1024).toFixed(2) + ' KB',
      type: file.type || 'application/octet-stream',
      file: file
    }));
    setAttachments(prev => [...prev, ...newAttachments]);
  };

  const removeAttachment = (id) => {
    setAttachments(prev => prev.filter(att => att.id !== id));
  };

  const createNewProtocol = () => {
    if (!newProtocol.email_cliente || !newProtocol.assunto_original) {
      addNotification('Preencha os campos obrigatórios', 'error');
      return;
    }

    const protocol = {
      id_protocolo: generateProtocolId(),
      data_entrada: new Date().toISOString(),
      email_cliente: newProtocol.email_cliente,
      assunto_original: newProtocol.assunto_original,
      status_processo: '1. Orçamento Solicitado',
      responsavel: newProtocol.responsavel || 'Não atribuído',
      data_ultima_atualizacao: new Date().toISOString(),
      detalhes: newProtocol.detalhes,
      aprovacao_orcamento: 'PENDENTE',
      confirmacao_cliente: 'PENDENTE',
      attachments: attachments.map(att => ({
        id: att.id,
        name: att.name,
        size: att.size,
        type: att.type
      }))
    };

    const updated = [...protocols, protocol];
    saveProtocols(updated);
    
    setShowNewProtocolModal(false);
    setNewProtocol({
      email_cliente: '',
      assunto_original: '',
      detalhes: '',
      responsavel: ''
    });
    setAttachments([]);
    
    addNotification(`Protocolo ${protocol.id_protocolo} criado com sucesso!`);
  };

  const updateProtocolStatus = (protocolId, newStatus) => {
    const updated = protocols.map(p => {
      if (p.id_protocolo === protocolId) {
        const updatedProtocol = {
          ...p,
          status_processo: newStatus,
          data_ultima_atualizacao: new Date().toISOString()
        };
        
        if (updatedProtocol.aprovacao_orcamento === 'APROVADO' && 
            updatedProtocol.confirmacao_cliente === 'CONFIRMADO' &&
            (newStatus === '1. Orçamento Solicitado' || newStatus === '2. Orçamento Enviado')) {
          updatedProtocol.status_processo = '3. Orçamento Aprovado - Iniciar Produção';
          addNotification('Aprovação dupla confirmada! Produção iniciada.', 'success');
        }
        
        return updatedProtocol;
      }
      return p;
    });
    
    saveProtocols(updated);
    setSelectedProtocol(updated.find(p => p.id_protocolo === protocolId));
    addNotification('Status atualizado com sucesso!');
  };

  const updateApprovalStatus = (protocolId, field, value) => {
    const updated = protocols.map(p => {
      if (p.id_protocolo === protocolId) {
        const updatedProtocol = {
          ...p,
          [field]: value,
          data_ultima_atualizacao: new Date().toISOString()
        };
        
        if (field === 'aprovacao_orcamento' && value === 'APROVADO' && 
            updatedProtocol.confirmacao_cliente === 'CONFIRMADO') {
          updatedProtocol.status_processo = '3. Orçamento Aprovado - Iniciar Produção';
          addNotification('Aprovação interna confirmada! Verificando aprovação dupla...', 'success');
        }
        
        if (field === 'confirmacao_cliente' && value === 'CONFIRMADO' && 
            updatedProtocol.aprovacao_orcamento === 'APROVADO') {
          updatedProtocol.status_processo = '3. Orçamento Aprovado - Iniciar Produção';
          addNotification('Cliente confirmou! Verificando aprovação dupla...', 'success');
        }
        
        return updatedProtocol;
      }
      return p;
    });
    
    saveProtocols(updated);
    setSelectedProtocol(updated.find(p => p.id_protocolo === protocolId));
  };

  const openEditModal = (protocol) => {
    setEditProtocol({...protocol});
    setShowEditModal(true);
  };

  const saveEditedProtocol = () => {
    const updated = protocols.map(p => 
      p.id_protocolo === editProtocol.id_protocolo 
        ? { ...editProtocol, data_ultima_atualizacao: new Date().toISOString() }
        : p
    );
    saveProtocols(updated);
    setShowEditModal(false);
    setEditProtocol(null);
    addNotification('Protocolo editado com sucesso!');
  };

  const deleteProtocol = (protocolId) => {
    if (window.confirm('Tem certeza que deseja excluir este protocolo? Esta ação não pode ser desfeita.')) {
      const updated = protocols.filter(p => p.id_protocolo !== protocolId);
      saveProtocols(updated);
      setShowDetailModal(false);
      setSelectedProtocol(null);
      addNotification('Protocolo excluído com sucesso!');
    }
  };

const exportToXLSX = () => {
  const headers = [
    'ID Protocolo',
    'Data de Entrada',
    'E-mail do Cliente',
    'Assunto',
    'Status do Processo',
    'Responsável',
    'Aprovação Orçamento',
    'Confirmação Cliente',
    'Última Atualização',
    'Detalhes',
    'Anexos'
  ];

  const rows = filteredProtocols.map(p => [
    p.id_protocolo,
    new Date(p.data_entrada).toLocaleString('pt-BR'),
    p.email_cliente,
    p.assunto_original,
    p.status_processo,
    p.responsavel,
    p.aprovacao_orcamento,
    p.confirmacao_cliente,
    new Date(p.data_ultima_atualizacao).toLocaleString('pt-BR'),
    p.detalhes || '',
    p.attachments ? p.attachments.length : 0
  ]);

  // Cria a planilha
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Protocolos');

  // Exporta o arquivo
  XLSX.writeFile(workbook, `protocolos_${new Date().toISOString().split('T')[0]}.xlsx`);

  addNotification('Planilha XLSX exportada com sucesso!');

  const getStatusColor = (status) => {
    const colors = {
      '1. Orçamento Solicitado': 'bg-amber-50 text-amber-700 border-amber-200',
      '2. Orçamento Enviado': 'bg-blue-50 text-blue-700 border-blue-200',
      '3. Orçamento Aprovado - Iniciar Produção': 'bg-emerald-50 text-emerald-700 border-emerald-200',
      '4. Entregue ao Cliente': 'bg-slate-50 text-slate-700 border-slate-200'
    };
    return colors[status] || 'bg-gray-50 text-gray-700';
  };

  const getStatusIcon = (status) => {
    const icons = {
      '1. Orçamento Solicitado': <Clock className="w-4 h-4" />,
      '2. Orçamento Enviado': <Mail className="w-4 h-4" />,
      '3. Orçamento Aprovado - Iniciar Produção': <CheckCircle className="w-4 h-4" />,
      '4. Entregue ao Cliente': <Package className="w-4 h-4" />
    };
    return icons[status] || <AlertCircle className="w-4 h-4" />;
  };

  const statusOptions = [
    '1. Orçamento Solicitado',
    '2. Orçamento Enviado',
    '3. Orçamento Aprovado - Iniciar Produção',
    '4. Entregue ao Cliente'
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
        {notifications.map(notif => (
          <div
            key={notif.id}
            className={`px-5 py-3 rounded-xl shadow-2xl ${
              notif.type === 'error' 
                ? 'bg-gradient-to-r from-red-500 to-red-600' 
                : 'bg-gradient-to-r from-emerald-500 to-emerald-600'
            } text-white animate-slide-in backdrop-blur-sm border border-white/20`}
          >
            <p className="font-medium">{notif.message}</p>
          </div>
        ))}
      </div>

      {/* Header Modernizado */}
      <div className="bg-white/80 backdrop-blur-md shadow-lg border-b border-slate-200/50 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-3 rounded-2xl shadow-lg">
                <FileText className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                  Sistema de Gestão de Protocolo
                </h1>
                <p className="text-sm text-slate-600 mt-1 font-medium">Gerenciamento profissional de orçamentos e entregas</p>
              </div>
            </div>
            <button
              onClick={() => setShowNewProtocolModal(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              <Plus className="w-5 h-5" />
              <span className="font-semibold">Novo Protocolo</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-lg border border-slate-200/50 p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar por ID, cliente ou assunto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/50 backdrop-blur-sm transition-all"
              />
            </div>
            <div className="flex gap-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-6 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/50 backdrop-blur-sm font-medium"
              >
                <option value="TODOS">📊 Todos os Status</option>
                {statusOptions.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
              <button
                  onClick={exportToXLSX}
                  className="flex items-center gap-2 px-6 py-3 border border-slate-300 rounded-xl hover:bg-white transition-all font-medium bg-white/50 backdrop-blur-sm shadow-sm hover:shadow-md"
                >
                <Download className="w-5 h-5" />
                Exportar XLSX
              </button>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-6">
          {statusOptions.map((status, idx) => {
            const count = protocols.filter(p => p.status_processo === status).length;
            const gradients = [
              'from-amber-400 to-orange-500',
              'from-blue-400 to-cyan-500',
              'from-emerald-400 to-green-500',
              'from-slate-400 to-gray-500'
            ];
            return (
              <div key={status} className="bg-white/80 backdrop-blur-md rounded-2xl shadow-lg border border-slate-200/50 p-6 hover:shadow-xl transition-all transform hover:-translate-y-1">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-600 uppercase tracking-wide">{status.split('.')[1]?.trim()}</p>
                    <p className="text-4xl font-bold text-slate-900 mt-2">{count}</p>
                  </div>
                  <div className={`p-4 rounded-2xl bg-gradient-to-br ${gradients[idx]} shadow-lg`}>
                    <div className="text-white">
                      {getStatusIcon(status)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Protocol Table */}
        <div className="mt-6 bg-white/80 backdrop-blur-md rounded-2xl shadow-lg border border-slate-200/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-slate-50 to-slate-100 border-b-2 border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">ID</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Cliente</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Responsável</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Aprovações</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Data</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Anexos</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredProtocols.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-16 text-center text-slate-500">
                      <AlertCircle className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                      <p className="text-lg font-semibold text-slate-700">Nenhum protocolo encontrado</p>
                      <p className="text-sm mt-2">Crie um novo protocolo para começar</p>
                    </td>
                  </tr>
                ) : (
                  filteredProtocols.map((protocol) => (
                    <tr key={protocol.id_protocolo} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-mono text-sm font-bold text-blue-600">{protocol.id_protocolo}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-semibold text-slate-900">{protocol.email_cliente}</div>
                        <div className="text-xs text-slate-500 truncate max-w-xs mt-1">{protocol.assunto_original}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border ${getStatusColor(protocol.status_processo)} shadow-sm`}>
                          {getStatusIcon(protocol.status_processo)}
                          {protocol.status_processo.split('.')[1]?.trim()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-700">
                        {protocol.responsavel}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex gap-2">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                            protocol.aprovacao_orcamento === 'APROVADO' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            Int: {protocol.aprovacao_orcamento}
                          </span>
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                            protocol.confirmacao_cliente === 'CONFIRMADO' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            Cli: {protocol.confirmacao_cliente}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 font-medium">
                        {new Date(protocol.data_entrada).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {protocol.attachments && protocol.attachments.length > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-100 text-blue-700">
                            <Paperclip className="w-3 h-3" />
                            {protocol.attachments.length}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setSelectedProtocol(protocol);
                              setShowDetailModal(true);
                            }}
                            className="text-blue-600 hover:text-blue-800 font-semibold hover:underline"
                          >
                            Abrir
                          </button>
                          <button
                            onClick={() => openEditModal(protocol)}
                            className="text-amber-600 hover:text-amber-800"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteProtocol(protocol.id_protocolo)}
                            className="text-red-600 hover:text-red-800"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal: New Protocol */}
      {showNewProtocolModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50">
              <h2 className="text-2xl font-bold text-slate-900">Criar Novo Protocolo</h2>
              <p className="text-sm text-slate-600 mt-1">Preencha os dados do orçamento solicitado</p>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    E-mail do Cliente *
                  </label>
                  <input
                    type="email"
                    value={newProtocol.email_cliente}
                    onChange={(e) => setNewProtocol({...newProtocol, email_cliente: e.target.value})}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="cliente@exemplo.com"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Assunto *
                  </label>
                  <input
                    type="text"
                    value={newProtocol.assunto_original}
                    onChange={(e) => setNewProtocol({...newProtocol, assunto_original: e.target.value})}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Solicitação de orçamento para..."
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Responsável
                  </label>
                  <input
                    type="text"
                    value={newProtocol.responsavel}
                    onChange={(e) => setNewProtocol({...newProtocol, responsavel: e.target.value})}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Nome do responsável"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Detalhes
                  </label>
                  <textarea
                    value={newProtocol.detalhes}
                    onChange={(e) => setNewProtocol({...newProtocol, detalhes: e.target.value})}
                    rows="4"
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Informações adicionais sobre o orçamento..."
                  />
                </div>
              </div>

              {/* Anexos */}
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 bg-slate-50">
                <label className="block text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                  <Paperclip className="w-5 h-5" />
                  Anexos (Todos os formatos)
                </label>
                <input
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  className="w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 file:cursor-pointer"
                />
                
                {attachments.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {attachments.map(att => (
                      <div key={att.id} className="flex items-center justify-between bg-white p-3 rounded-lg border border-slate-200">
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-blue-600" />
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{att.name}</p>
                            <p className="text-xs text-slate-500">{att.size}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => removeAttachment(att.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3 bg-slate-50">
              <button
                onClick={() => {
                  setShowNewProtocolModal(false);
                  setAttachments([]);
                }}
                className="px-6 py-3 border-2 border-slate-300 rounded-xl hover:bg-white transition-all font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={createNewProtocol}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all font-semibold shadow-lg"
              >
                Criar Protocolo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit Protocol */}
      {showEditModal && editProtocol && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-amber-50 to-orange-50">
              <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <Edit2 className="w-6 h-6" />
                Editar Protocolo {editProtocol.id_protocolo}
              </h2>
              <p className="text-sm text-slate-600 mt-1">Altere as informações necessárias</p>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-2">E-mail do Cliente</label>
                  <input
                    type="email"
                    value={editProtocol.email_cliente}
                    onChange={(e) => setEditProtocol({...editProtocol, email_cliente: e.target.value})}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-2">Assunto</label>
                  <input
                    type="text"
                    value={editProtocol.assunto_original}
                    onChange={(e) => setEditProtocol({...editProtocol, assunto_original: e.target.value})}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-2">Responsável</label>
                  <input
                    type="text"
                    value={editProtocol.responsavel}
                    onChange={(e) => setEditProtocol({...editProtocol, responsavel: e.target.value})}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-2">Detalhes</label>
                  <textarea
                    value={editProtocol.detalhes || ''}
                    onChange={(e) => setEditProtocol({...editProtocol, detalhes: e.target.value})}
                    rows="4"
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent"
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
                className="px-6 py-3 border-2 border-slate-300 rounded-xl hover:bg-white transition-all font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={saveEditedProtocol}
                className="px-6 py-3 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl hover:from-amber-700 hover:to-orange-700 transition-all font-semibold shadow-lg flex items-center gap-2"
              >
                <Save className="w-5 h-5" />
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Protocol Details */}
      {showDetailModal && selectedProtocol && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Protocolo {selectedProtocol.id_protocolo}</h2>
                  <p className="text-sm text-slate-600 mt-1">Gerenciar status e aprovações</p>
                </div>
                <button
                  onClick={() => deleteProtocol(selectedProtocol.id_protocolo)}
                  className="px-4 py-2 bg-red-100 text-red-700 rounded-xl hover:bg-red-200 transition-all font-semibold flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Excluir
                </button>
              </div>
            </div>
            <div className="p-6 space-y-6">
              {/* Informações Básicas */}
              <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4">Informações do Cliente</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Cliente</label>
                    <p className="text-sm font-semibold text-slate-900">{selectedProtocol.email_cliente}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Responsável</label>
                    <p className="text-sm font-semibold text-slate-900">{selectedProtocol.responsavel}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Data de Entrada</label>
                    <p className="text-sm font-semibold text-slate-900">{new Date(selectedProtocol.data_entrada).toLocaleString('pt-BR')}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Última Atualização</label>
                    <p className="text-sm font-semibold text-slate-900">{new Date(selectedProtocol.data_ultima_atualizacao).toLocaleString('pt-BR')}</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Assunto</label>
                <p className="text-sm text-slate-900 bg-slate-50 p-4 rounded-xl border border-slate-200">{selectedProtocol.assunto_original}</p>
              </div>

              {selectedProtocol.detalhes && (
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Detalhes</label>
                  <p className="text-sm text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-200 whitespace-pre-wrap">{selectedProtocol.detalhes}</p>
                </div>
              )}

              {/* Anexos */}
              {selectedProtocol.attachments && selectedProtocol.attachments.length > 0 && (
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                    <Paperclip className="w-5 h-5" />
                    Anexos ({selectedProtocol.attachments.length})
                  </label>
                  <div className="space-y-2">
                    {selectedProtocol.attachments.map(att => (
                      <div key={att.id} className="flex items-center gap-3 bg-blue-50 p-4 rounded-xl border border-blue-200">
                        <FileText className="w-6 h-6 text-blue-600" />
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-slate-900">{att.name}</p>
                          <p className="text-xs text-slate-600">{att.size} • {att.type}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Status e Aprovações */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-5 border-2 border-blue-200">
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4">Controle de Processo</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Status do Processo</label>
                    <select
                      value={selectedProtocol.status_processo}
                      onChange={(e) => updateProtocolStatus(selectedProtocol.id_protocolo, e.target.value)}
                      className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-semibold bg-white"
                    >
                      {statusOptions.map(status => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Aprovação Interna</label>
                      <select
                        value={selectedProtocol.aprovacao_orcamento}
                        onChange={(e) => updateApprovalStatus(selectedProtocol.id_protocolo, 'aprovacao_orcamento', e.target.value)}
                        className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-semibold bg-white"
                      >
                        <option value="PENDENTE">⏳ PENDENTE</option>
                        <option value="APROVADO">✅ APROVADO</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Confirmação Cliente</label>
                      <select
                        value={selectedProtocol.confirmacao_cliente}
                        onChange={(e) => updateApprovalStatus(selectedProtocol.id_protocolo, 'confirmacao_cliente', e.target.value)}
                        className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-semibold bg-white"
                      >
                        <option value="PENDENTE">⏳ PENDENTE</option>
                        <option value="CONFIRMADO">✅ CONFIRMADO</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Alerta de Aprovação Dupla */}
              {selectedProtocol.aprovacao_orcamento === 'APROVADO' && selectedProtocol.confirmacao_cliente === 'CONFIRMADO' && (
                <div className="bg-gradient-to-r from-emerald-50 to-green-50 border-2 border-emerald-300 rounded-xl p-5 flex items-start gap-4 shadow-lg">
                  <div className="bg-emerald-500 p-3 rounded-xl">
                    <CheckCircle className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-emerald-900 text-lg">🎉 Aprovação Dupla Confirmada!</p>
                    <p className="text-sm text-emerald-700 mt-2">
                      Tanto a aprovação interna quanto a confirmação do cliente foram concluídas com sucesso. 
                      O sistema mudará automaticamente o status para <strong>"Orçamento Aprovado - Iniciar Produção"</strong>.
                    </p>
                  </div>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-between bg-slate-50">
              <button
                onClick={() => openEditModal(selectedProtocol)}
                className="px-6 py-3 bg-amber-100 text-amber-700 rounded-xl hover:bg-amber-200 transition-all font-semibold flex items-center gap-2"
              >
                <Edit2 className="w-5 h-5" />
                Editar Protocolo
              </button>
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedProtocol(null);
                }}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all font-semibold shadow-lg"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProtocolManagementSystem;
