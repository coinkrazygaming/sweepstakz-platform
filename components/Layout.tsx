
import React, { useMemo } from 'react';
// Fix: Removed non-existent Theme from imports
import { User, UserRole, Operator } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  user: User | null;
  operator?: Operator;
  onLogout: () => void;
  onSwitchRole: (role: UserRole) => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const THEMES_LIST = [
  { id: 'default', name: 'Modern Indigo', primary: '#6366f1', secondary: '#4f46e5', bgClass: 'bg-slate-950' },
  { id: 'vegas', name: 'Vegas Classic', primary: '#ef4444', secondary: '#b91c1c', bgClass: 'bg-stone-950' },
  { id: 'cyber', name: 'Cyber Neon', primary: '#f0abfc', secondary: '#c026d3', bgClass: 'bg-black' },
  { id: 'royal', name: 'Royal Gold', primary: '#fbbf24', secondary: '#d97706', bgClass: 'bg-zinc-950' },
  { id: 'ocean', name: 'Ocean Deep', primary: '#0ea5e9', secondary: '#0369a1', bgClass: 'bg-sky-950' }
];

export const Layout: React.FC<LayoutProps> = ({ 
  children, 
  user, 
  operator, 
  onLogout, 
  onSwitchRole,
  activeTab,
  onTabChange
}) => {
  const styling = useMemo(() => {
    // Theme application for players
    const activeThemeId = operator?.branding?.themeId || 'default';
    const activeTheme = THEMES_LIST.find(t => t.id === activeThemeId) || THEMES_LIST[0];
    
    if (user?.role === UserRole.MASTER_ADMIN) {
      return {
        primary: '#6366f1',
        bgClass: 'bg-slate-950',
        label: 'Platform Core v5.0'
      };
    }
    
    if (user?.role === UserRole.OPERATOR) {
      return {
        primary: operator?.branding.primaryColor || '#6366f1',
        bgClass: 'bg-slate-950',
        label: `Operator Admin: ${operator?.name || 'Shard'}`
      };
    }

    return {
      primary: operator?.branding.primaryColor || activeTheme.primary,
      bgClass: activeTheme.bgClass,
      label: operator?.branding.siteName || 'Casino Floor'
    };
  }, [user?.role, operator]);

  return (
    <div className={`min-h-screen flex flex-col transition-all duration-700 ${styling.bgClass}`}>
      {/* Universal Multi-Tenant Navbar */}
      <nav className="glass border-b border-white/5 px-8 py-5 flex justify-between items-center sticky top-0 z-[60]">
        <div className="flex items-center gap-5">
          <div 
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-2xl transition-all duration-1000 rotate-2"
            style={{ background: `linear-gradient(135deg, ${styling.primary}, #000000)` }}
          >
            {operator?.branding.siteName[0] || 'S'}
          </div>
          <div>
            <h1 className="font-black text-xl italic leading-none tracking-tighter uppercase">
              {operator?.branding.siteName || 'SweepStack'}
            </h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
              {styling.label}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-8">
          {user?.role === UserRole.PLAYER && user.wallet && (
            <div className="hidden md:flex gap-6 bg-slate-900/60 p-2 px-6 rounded-2xl border border-white/5">
              <div className="flex items-center gap-3">
                <span className="text-yellow-500 font-black text-[10px] uppercase">GC</span>
                <span className="font-mono text-sm font-bold">{user.wallet.goldCoins.toLocaleString()}</span>
              </div>
              <div className="w-px h-5 bg-white/10 self-center"></div>
              <div className="flex items-center gap-3">
                <span className="text-blue-400 font-black text-[10px] uppercase">SC</span>
                <span className="font-mono text-sm font-bold">{user.wallet.sweepsCoins.toFixed(2)}</span>
              </div>
            </div>
          )}

          <div className="flex items-center gap-6">
            <div className="text-right hidden sm:block">
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{user?.role}</p>
              <p className="text-sm font-bold text-white italic">{user?.username}</p>
            </div>
            <button 
              onClick={onLogout}
              className="p-3 px-5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all text-sm font-black border border-red-500/10 uppercase tracking-widest"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Main Experience Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Core Sidebar */}
        <aside className="w-72 glass border-r border-white/5 p-8 hidden lg:flex flex-col gap-3">
          <h3 className="text-[9px] font-black text-slate-600 uppercase tracking-[0.4em] mb-4">Ingress Control</h3>
          
          {user?.role === UserRole.PLAYER && (
            <>
              <SidebarItem icon="fa-gamepad" label="Casino Floor" active={activeTab === 'GAMES'} onClick={() => onTabChange('GAMES')} primary={styling.primary} />
              <SidebarItem icon="fa-gem" label="Prize Store" active={activeTab === 'STORE'} onClick={() => onTabChange('STORE')} primary={styling.primary} />
              <SidebarItem icon="fa-wallet" label="Redeem Prizes" active={activeTab === 'REDEMPTIONS'} onClick={() => onTabChange('REDEMPTIONS')} primary={styling.primary} />
              <SidebarItem icon="fa-clock-rotate-left" label="Activity Log" active={activeTab === 'HISTORY'} onClick={() => onTabChange('HISTORY')} primary={styling.primary} />
            </>
          )}

          {user?.role === UserRole.MASTER_ADMIN && (
            <>
              <SidebarItem icon="fa-server" label="Tenant Shards" active={activeTab === 'TENANTS'} onClick={() => onTabChange('TENANTS')} primary={styling.primary} />
              <SidebarItem icon="fa-chart-line" label="Market Metrics" active={activeTab === 'REVENUE'} onClick={() => onTabChange('REVENUE')} primary={styling.primary} />
              <SidebarItem icon="fa-user-shield" label="Global Audit" active={activeTab === 'AUDIT'} onClick={() => onTabChange('AUDIT')} primary={styling.primary} />
            </>
          )}

          {user?.role === UserRole.OPERATOR && (
            <>
              <SidebarItem icon="fa-gauge-high" label="Analytics" active={activeTab === 'DASHBOARD'} onClick={() => onTabChange('DASHBOARD')} primary={styling.primary} />
              <SidebarItem icon="fa-user-group" label="Manage Players" active={activeTab === 'PLAYERS'} onClick={() => onTabChange('PLAYERS')} primary={styling.primary} />
              <SidebarItem icon="fa-microchip" label="Node Settings" active={activeTab === 'BRANDING'} onClick={() => onTabChange('BRANDING')} primary={styling.primary} />
            </>
          )}
          
          <div className="mt-auto p-6 bg-slate-900/40 rounded-3xl border border-white/5 text-center">
            <p className="text-[10px] text-slate-500 font-black tracking-widest uppercase mb-3">Node Connectivity</p>
            <div className="flex items-center justify-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
              <span className="text-[10px] text-white font-black italic uppercase tracking-tighter">Healthy Deployment</span>
            </div>
          </div>
        </aside>

        {/* Shard Content */}
        <main className="flex-1 overflow-y-auto p-8 lg:p-12">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

const SidebarItem = ({ icon, label, active, onClick, primary }: { icon: string; label: string; active: boolean; onClick: () => void; primary: string }) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-4 w-full p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all group ${active ? 'bg-white/5 text-white shadow-xl' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
    style={active ? { borderLeft: `4px solid ${primary}` } : {}}
  >
    <i className={`fa-solid ${icon} w-6 text-center text-sm transition-colors`} style={active ? { color: primary } : {}}></i>
    {label}
  </button>
);