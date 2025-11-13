import React, { useState, useEffect } from 'react';
import { Search, Plus, Mail, CheckCircle, Clock, Package, AlertCircle, Download } from 'lucide-react';

const ProtocolManagementSystem = () => {
  const [protocols, setProtocols] = useState([]);
  const [filteredProtocols, setFilteredProtocols] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const [showNewProtocolModal, setShowNewProtocolModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedProtocol, setSelectedProtocol] = useState(null);
  const [notifications, setNotifications] = useState([]);

  const [newProtocol, setNewProtocol] = useState({
    email_cliente: '',
    assunto_original: '',
    detalhes: '',
    responsavel: ''
  });

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
      confirmacao_cliente: 'PENDENTE'
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
  };

  const exportToCSV = () => {
    const headers = ['ID Protocolo', 'Data Entrada', 'Cliente', 'Status', 'Responsável', 'Aprovação Orçamento', 'Confirmação Cliente'];
    const rows = filteredProtocols.map(p => [
      p.id_protocolo,
      new Date(p.data_entrada).toLocaleString('pt-BR'),
      p.email_cliente,
      p.status_processo,
      p.responsavel,
      p.aprovacao_orcamento,
      p.confirmacao_cliente
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `protocolos_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const getStatusColor = (status) => {
    const colors = {
      '1. Orçamento Solicitado': 'bg-yellow-100 text-yellow-800 border-yellow-300',
      '2. Orçamento Enviado': 'bg-blue-100 text-blue-800 border-blue-300',
      '3. Orçamento Aprovado - Iniciar Produção': 'bg-green-100 text-green-800 border-green-300',
      '4. Entregue ao Cliente': 'bg-gray-100 text-gray-800 border-gray-300'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {notifications.map(notif => (
          <div
            key={notif.id}
            className={`px-4 py-3 rounded-lg shadow-lg ${
              notif.type === 'error' ? 'bg-red-500' : 'bg-green-500'
            } text-white animate-slide-in`}
          >
            {notif.message}
          </div>
        ))}
      </div>

      <div className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Sistema de Gestão de Protocolo</h1>
              <p className="text-sm text-slate-600 mt-1">Gerenciamento automatizado de orçamentos e entregas</p>
            </div>
            <button
              onClick={() => setShowNewProtocolModal(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Novo Protocolo
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar por ID, cliente ou assunto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="TODOS">Todos os Status</option>
                {statusOptions.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
              <button
                onClick={exportToCSV}
                className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <Download className="w-4 h-4" />
                Exportar
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
          {statusOptions.map(status => {
            const count = protocols.filter(p => p.status_processo === status).length;
            return (
              <div key={status} className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">{status.split('.')[1]?.trim()}</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{count}</p>
                  </div>
                  <div className={`p-3 rounded-lg ${getStatusColor(status)}`}>
                    {getStatusIcon(status)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">ID Protocolo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Cliente</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Responsável</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Aprovações</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Data</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredProtocols.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center text-slate-500">
                      <AlertCircle className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                      <p>Nenhum protocolo encontrado</p>
                      <p className="text-sm mt-1">Crie um novo protocolo para começar</p>
                    </td>
                  </tr>
                ) : (
                  filteredProtocols.map((protocol) => (
                    <tr key={protocol.id_protocolo} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-mono text-sm font-medium text-slate-900">{protocol.id_protocolo}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-slate-900">{protocol.email_cliente}</div>
                        <div className="text-xs text-slate-500 truncate max-w-xs">{protocol.assunto_original}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(protocol.status_processo)}`}>
                          {getStatusIcon(protocol.status_processo)}
                          {protocol.status_processo.split('.')[1]?.trim()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                        {protocol.responsavel}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex gap-2">
                          <span className={`px-2 py-1 rounded text-xs ${
                            protocol.aprovacao_orcamento === 'APROVADO' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            Interno: {protocol.aprovacao_orcamento}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs ${
                            protocol.confirmacao_cliente === 'CONFIRMADO' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            Cliente: {protocol.confirmacao_cliente}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                        {new Date(protocol.data_entrada).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => {
                            setSelectedProtocol(protocol);
                            setShowDetailModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Ver Detalhes
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showNewProtocolModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-900">Novo Protocolo</h2>
              <p className="text-sm text-slate-600 mt-1">Simula o recebimento de um e-mail de solicitação</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  E-mail do Cliente *
                </label>
                <input
                  type="email"
                  value={newProtocol.email_cliente}
                  onChange={(e) => setNewProtocol({...newProtocol, email_cliente: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="cliente@exemplo.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Assunto *
                </label>
                <input
                  type="text"
                  value={newProtocol.assunto_original}
                  onChange={(e) => setNewProtocol({...newProtocol, assunto_original: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Solicitação de orçamento para..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Responsável
                </label>
                <input
                  type="text"
                  value={newProtocol.responsavel}
                  onChange={(e) => setNewProtocol({...newProtocol, responsavel: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Nome do responsável"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Detalhes
                </label>
                <textarea
                  value={newProtocol.detalhes}
                  onChange={(e) => setNewProtocol({...newProtocol, detalhes: e.target.value})}
                  rows="4"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Conteúdo do e-mail..."
                />
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setShowNewProtocolModal(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={createNewProtocol}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Criar Protocolo
              </button>
            </div>
          </div>
        </div>
      )}

      {showDetailModal && selectedProtocol && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-900">Protocolo {selectedProtocol.id_protocolo}</h2>
              <p className="text-sm text-slate-600 mt-1">Gerenciar status e aprovações</p>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cliente</label>
                  <p className="text-slate-900">{selectedProtocol.email_cliente}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Responsável</label>
                  <p className="text-slate-900">{selectedProtocol.responsavel}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data de Entrada</label>
                  <p className="text-slate-900">{new Date(selectedProtocol.data_entrada).toLocaleString('pt-BR')}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Última Atualização</label>
                  <p className="text-slate-900">{new Date(selectedProtocol.data_ultima_atualizacao).toLocaleString('pt-BR')}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Assunto</label>
                <p className="text-slate-900">{selectedProtocol.assunto_original}</p>
              </div>

              {selectedProtocol.detalhes && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Detalhes</label>
                  <p className="text-slate-700 text-sm bg-slate-50 p-3 rounded-lg">{selectedProtocol.detalhes}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Status do Processo</label>
                <select
                  value={selectedProtocol.status_processo}
                  onChange={(e) => updateProtocolStatus(selectedProtocol.id_protocolo, e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {statusOptions.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Aprovação Interna (Orçamento)</label>
                  <select
                    value={selectedProtocol.aprovacao_orcamento}
                    onChange={(e) => updateApprovalStatus(selectedProtocol.id_protocolo, 'aprovacao_orcamento', e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="PENDENTE">PENDENTE</option>
                    <option value="APROVADO">APROVADO</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Confirmação do Cliente</label>
                  <select
                    value={selectedProtocol.confirmacao_cliente}
                    onChange={(e) => updateApprovalStatus(selectedProtocol.id_protocolo, 'confirmacao_cliente', e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="PENDENTE">PENDENTE</option>
                    <option value="CONFIRMADO">CONFIRMADO</option>
                  </select>
                </div>
              </div>

              {selectedProtocol.aprovacao_orcamento === 'APROVADO' && selectedProtocol.confirmacao_cliente === 'CONFIRMADO' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-green-900">Aprovação Dupla Confirmada</p>
                    <p className="text-sm text-green-700 mt-1">
                      Tanto a aprovação interna quanto a confirmação do cliente foram concluídas. 
                      O sistema automaticamente mudará o status para "Orçamento Aprovado - Iniciar Produção".
                    </p>
                  </div>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedProtocol(null);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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