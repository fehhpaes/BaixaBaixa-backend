import { Play, Pause, Trash2, ExternalLink, Activity, Image, Download, Folder } from 'lucide-react';

const ChannelCard = ({ channel, onToggle, onDelete, onDownloadAll }) => {
  const getStatusClass = (status) => {
    switch (status) {
      case 'monitoring': return 'status-monitoring';
      case 'downloading': return 'status-downloading';
      default: return 'status-idle';
    }
  };

  return (
    <div className="glass-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {channel.type === 'posts' ? <Image size={18} color="var(--accent)"/> : <Activity size={18} color="var(--accent)"/>}
          <h3 style={{ margin: 0, fontSize: '1.25rem' }}>{channel.name}</h3>
        </div>
        <span className={`status-badge ${getStatusClass(channel.status)}`}>
          {channel.status}
        </span>
      </div>
      
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem', wordBreak: 'break-all' }}>
        {channel.url}
      </p>

      {channel.save_path && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent)', fontSize: '0.8rem', marginBottom: '1.5rem', opacity: 0.8 }}>
          <Folder size={14}/>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {channel.save_path}
          </span>
        </div>
      )}

      {!channel.save_path && <div style={{ marginBottom: '1.5rem' }}></div>}

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
        <button 
          onClick={() => onToggle(channel._id)}
          style={{ 
            flex: 1, 
            background: channel.status === 'idle' ? 'var(--accent)' : 'rgba(255,255,255,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem'
          }}
        >
          {channel.status === 'idle' ? <Play size={18}/> : <Pause size={18}/>}
          {channel.status === 'idle' ? 'Start' : 'Stop'}
        </button>
        
        <button 
          onClick={() => onDelete(channel._id)}
          title="Excluir"
          style={{ 
            background: 'rgba(239, 68, 68, 0.1)', 
            color: 'var(--error)',
            padding: '0.75rem' 
          }}
        >
          <Trash2 size={18}/>
        </button>

        <button 
          onClick={() => onDownloadAll(channel._id)}
          title="Baixar TUDO disponível"
          style={{ 
            background: 'rgba(34, 197, 94, 0.1)', 
            color: 'var(--success)',
            padding: '0.75rem' 
          }}
        >
          <Download size={18}/>
        </button>
      </div>
    </div>
  );
};

export default ChannelCard;
