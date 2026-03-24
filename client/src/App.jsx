import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ChannelCard from './components/ChannelCard';
import { Plus, LayoutGrid, Cloud, Settings, CheckCircle2, XCircle, ExternalLink, LogIn, UserPlus, LogOut } from 'lucide-react';

const API_BASE = '/api';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [channels, setChannels] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [cloudStatus, setCloudStatus] = useState({ google: false, microsoft: false });
  
  // Auth Form State
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // New Channel State
  const [newUrl, setNewUrl] = useState('');
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('live');
  const [newSavePath, setNewSavePath] = useState('');

  const authAxios = axios.create({
    baseURL: API_BASE,
    headers: { Authorization: `Bearer ${token}` }
  });

  const fetchChannels = async () => {
    if (!token) return;
    try {
      const res = await authAxios.get('/channels');
      setChannels(res.data);
    } catch (err) {
      if (err.response?.status === 401) handleLogout();
    }
  };

  const fetchCloudStatus = async () => {
    if (!token) return;
    try {
      const res = await authAxios.get('/auth/status');
      setCloudStatus(res.data);
    } catch (err) {}
  };

  useEffect(() => {
    if (token) {
      fetchChannels();
      fetchCloudStatus();
      const interval = setInterval(() => {
        fetchChannels();
        fetchCloudStatus();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [token]);

  const handleAuth = async (e) => {
    e.preventDefault();
    const endpoint = isRegister ? '/auth/register' : '/auth/login';
    try {
      const res = await axios.post(`${API_BASE}${endpoint}`, { email, password });
      const newToken = res.data.token;
      localStorage.setItem('token', newToken);
      setToken(newToken);
    } catch (err) {
      alert(err.response?.data?.message || 'Erro na autenticação');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setChannels([]);
  };

  const handleAddChannel = async (e) => {
    e.preventDefault();
    try {
      await authAxios.post('/channels', { name: newName, url: newUrl, type: newType, save_path: newSavePath });
      setNewUrl(''); setNewName(''); setNewSavePath('');
      fetchChannels();
    } catch (err) { alert('Erro ao adicionar canal.'); }
  };

  const handleToggle = async (id) => {
    try {
      await authAxios.post(`/channels/${id}/toggle`);
      fetchChannels();
    } catch (err) {}
  };

  const handleDelete = async (id) => {
    if (window.confirm('Excluir este canal?')) {
      await authAxios.delete(`/channels/${id}`);
      fetchChannels();
    }
  };

  const handleDownloadAll = (id) => authAxios.post(`/channels/${id}/download-all`);

  const handleConnectCloud = async (platform) => {
    const res = await authAxios.get(`/auth/${platform}/url`);
    window.open(res.data.url, 'Cloud', 'width=600,height=700');
  };

  const [configStatus, setConfigStatus] = useState({ google: false, microsoft: false, loading: true });

  const fetchConfigStatus = async () => {
    try {
      const res = await axios.get(`${API_BASE}/config/status`);
      setConfigStatus({ ...res.data, loading: false });
    } catch (err) {
      setConfigStatus(prev => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    fetchConfigStatus();
  }, []);

  const handleSocialLogin = async (platform) => {
    try {
      const res = await axios.get(`${API_BASE}/auth/${platform}/login-url`);
      if (res.data.url) {
        window.open(res.data.url, 'Login', 'width=500,height=600');
        window.addEventListener('message', (e) => {
          if (e.data.token) {
            localStorage.setItem('token', e.data.token);
            setToken(e.data.token);
          }
        }, { once: true });
      } else {
        alert(`Erro ao obter URL de login do ${platform}.`);
      }
    } catch (err) {
      alert("Erro de conexão com o servidor. Verifique o VITE_API_BASE.");
    }
  };

  if (configStatus.loading) return <div className="dashboard" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>Carregando...</div>;


  if (!token) {
    return (
      <div className="dashboard" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="glass-card" style={{ padding: '3rem', width: '100%', maxWidth: '400px', textAlign: 'center' }}>
          <h1 style={{ marginBottom: '1rem' }}>BaixaBaixa</h1>
          <p style={{ opacity: 0.7, marginBottom: '2.5rem' }}>Login Obrigatório</p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {configStatus.google && (
              <button onClick={() => handleSocialLogin('google')} className="btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.8rem', padding: '1rem' }}>
                <img src="https://www.google.com/favicon.ico" width="20" alt="G" /> Entrar com Google
              </button>
            )}
            
            {configStatus.microsoft && (
              <button onClick={() => handleSocialLogin('microsoft')} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.8rem', padding: '1rem' }}>
                <img src="https://www.microsoft.com/favicon.ico" width="20" alt="M" /> Entrar com Microsoft
              </button>
            )}

            {!configStatus.google && !configStatus.microsoft && (
              <p style={{ color: '#ff4b2b', fontSize: '0.9rem' }}>Nenhum provedor de login configurado.</p>
            )}

          </div>

          <div style={{ marginTop: '2rem', fontSize: '0.8rem', opacity: 0.5 }}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '1rem' }}>
              <a href="#" style={{ color: 'inherit', textDecoration: 'underline' }}>Privacidade</a>
              <a href="#" style={{ color: 'inherit', textDecoration: 'underline' }}>Termos</a>
              <a href="#" style={{ color: 'inherit', textDecoration: 'underline' }}>Sobre</a>
            </div>
            Ao entrar, você concorda com nossos Termos de Uso.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <header>
        <div className="logo" onClick={() => setActiveTab('dashboard')} style={{ cursor: 'pointer' }}>BaixaBaixa</div>
        <nav style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <LayoutGrid size={22} 
            onClick={() => setActiveTab('dashboard')} 
            style={{ cursor: 'pointer', color: activeTab === 'dashboard' ? 'var(--primary)' : 'white' }}
          />
          <Cloud size={22} 
            onClick={() => setActiveTab('cloud')} 
            style={{ cursor: 'pointer', color: activeTab === 'cloud' ? 'var(--primary)' : 'white' }}
          />
          <LogOut size={22} onClick={handleLogout} style={{ cursor: 'pointer', opacity: 0.6 }} />
        </nav>
      </header>

      <main>
        {activeTab === 'dashboard' ? (
          <>
            <section className="glass-card" style={{ marginBottom: '3rem', padding: '2rem' }}>
              <h2 style={{ marginBottom: '1.5rem' }}>Monitorar Nova Mídia</h2>
              <form onSubmit={handleAddChannel} className="add-channel-form" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <input placeholder="Nome" value={newName} onChange={e => setNewName(e.target.value)} />
                <input placeholder="URL" value={newUrl} onChange={e => setNewUrl(e.target.value)} />
                <input placeholder="Destino (Opcional)" value={newSavePath} onChange={e => setNewSavePath(e.target.value)} />
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <select value={newType} onChange={e => setNewType(e.target.value)} style={{ flex: 1 }}>
                    <option value="live">Live</option>
                    <option value="posts">Posts/Fotos</option>
                  </select>
                  <button type="submit" style={{ padding: '0 2rem' }}><Plus size={20}/></button>
                </div>
              </form>
            </section>

            <div className="channel-grid">
              {channels.map(channel => (
                <ChannelCard key={channel._id} channel={channel} onToggle={handleToggle} onDelete={handleDelete} onDownloadAll={handleDownloadAll} />
              ))}
            </div>
          </>
        ) : (
          <section className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
            <h2 style={{ marginBottom: '1rem' }}>Conexão com a Nuvem</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem', marginTop: '2rem' }}>
              <div className="glass-card" style={{ padding: '2rem', background: 'rgba(255,255,255,0.02)' }}>
                <h3>Google Drive</h3>
                <div style={{ margin: '1.5rem 0' }}>
                  {cloudStatus.google ? <span style={{ color: '#10b981' }}><CheckCircle2 size={16}/> Conectado</span> : <span style={{ opacity: 0.6 }}><XCircle size={16}/> Desconectado</span>}
                </div>
                <button onClick={() => handleConnectCloud('google')} style={{ width: '100%' }}>{cloudStatus.google ? 'Reconectar' : 'Conectar Google'}</button>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
