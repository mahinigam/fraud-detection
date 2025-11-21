import { motion } from 'framer-motion';
import { useState } from 'react';
import { 
  Home, 
  CreditCard, 
  Shield, 
  FileText, 
  Settings,
  TrendingUp,
  LogOut,
  User,
  Crown,
  Search,
  Eye
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usePermissionGuard } from './RouteProtection';

// Role-based navigation items
const getNavigationItems = (userRole: string) => {
  const baseItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, roles: ['admin', 'analyst', 'auditor'] },
    { id: 'risk-scoring', label: 'Risk Scoring', icon: Shield, roles: ['admin', 'analyst'] },
    { id: 'transactions', label: 'Transactions', icon: CreditCard, roles: ['admin', 'analyst'] },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp, roles: ['admin', 'analyst', 'auditor'] },
    { id: 'reports', label: 'Reports', icon: FileText, roles: ['admin', 'analyst', 'auditor'] },
  ];

  const adminItems = [
    { id: 'audit-logs', label: 'Audit Logs', icon: Eye, roles: ['admin', 'auditor'] },
    { id: 'admin-dashboard', label: 'Admin Panel', icon: User, roles: ['admin'] },
    { id: 'system-config', label: 'System Config', icon: Settings, roles: ['admin'] },
    { id: 'settings', label: 'Settings', icon: Settings, roles: ['admin'] },
  ];

  return [...baseItems, ...adminItems].filter(item => 
    item.roles.includes(userRole)
  );
};

// Role display configurations
const roleConfigs = {
  admin: { 
    icon: Crown, 
    color: 'from-yellow-500 to-orange-600', 
    label: 'Administrator',
    description: 'Full System Access'
  },
  analyst: { 
    icon: Search, 
    color: 'from-blue-500 to-purple-600', 
    label: 'Security Analyst',
    description: 'Risk Assessment'
  },
  auditor: { 
    icon: Eye, 
    color: 'from-green-500 to-teal-600', 
    label: 'Auditor',
    description: 'Compliance Review'
  }
};

interface SidebarProps {
  onNavigate?: (itemId: string) => void;
}

export default function Sidebar({ onNavigate }: SidebarProps) {
  const { userProfile, signOut } = useAuth();
  const [activeItem, setActiveItem] = useState('risk-scoring');
  const [showUserMenu, setShowUserMenu] = useState(false);

  const navigationItems = userProfile ? getNavigationItems(userProfile.role) : [];
  const roleConfig = userProfile ? roleConfigs[userProfile.role] : null;

  const handleNavigation = (itemId: string) => {
    setActiveItem(itemId);
    onNavigate?.(itemId);
    setShowUserMenu(false); // Close user menu on navigation
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase();
  };

  return (
    <motion.div 
      className="sidebar"
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Logo/Brand - Compact */}
      <div className="mb-6">
        <motion.div 
          className="flex items-center gap-2"
          whileHover={{ scale: 1.02 }}
          transition={{ duration: 0.2 }}
        >
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gradient">FraudGuard</h1>
            <p className="text-xs text-white/60">AI Detection</p>
          </div>
        </motion.div>
      </div>

      {/* Navigation - Compact */}
      <nav className="flex-1 min-h-0">
        <div className="mb-4">
          <div className="space-y-1">
            {navigationItems.map((item, index) => (
              <motion.button
                key={item.id}
                className={`nav-item w-full text-left ${activeItem === item.id ? 'active' : ''}`}
                onClick={() => handleNavigation(item.id)}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                whileHover={{ x: 4, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <item.icon className="w-4 h-4 nav-icon" />
                <span className="font-medium text-sm">{item.label}</span>
                {activeItem === item.id && (
                  <motion.div
                    className="absolute right-3 w-2 h-2 bg-white rounded-full"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.2 }}
                  />
                )}
              </motion.button>
            ))}
          </div>
        </div>
      </nav>

      {/* Enhanced User Section */}
      {userProfile && roleConfig && (
        <motion.div 
          className="mt-auto space-y-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
        >
          {/* User Profile Card */}
          <div className="glass-panel p-3 relative">
            <motion.button
              className="w-full flex items-center gap-3 text-left"
              onClick={() => setShowUserMenu(!showUserMenu)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className={`w-10 h-10 bg-gradient-to-br ${roleConfig.color} rounded-full flex items-center justify-center relative`}>
                {userProfile.avatar_url ? (
                  <img 
                    src={userProfile.avatar_url} 
                    alt="Profile" 
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <span className="text-white font-bold text-sm">
                    {getInitials(userProfile.full_name || userProfile.email)}
                  </span>
                )}
                <roleConfig.icon className="absolute -bottom-1 -right-1 w-4 h-4 text-white bg-slate-800 rounded-full p-0.5" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white truncate">
                  {userProfile.full_name || 'User'}
                </div>
                <div className="text-xs text-white/60 truncate">
                  {roleConfig.label}
                </div>
                <div className="text-xs text-white/40">
                  {roleConfig.description}
                </div>
              </div>
            </motion.button>

            {/* User Menu Dropdown */}
            {showUserMenu && (
              <motion.div
                className="absolute bottom-full left-0 right-0 mb-2 glass-panel p-2 space-y-1"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
              >
                <button
                  onClick={() => {
                    handleNavigation('profile');
                    setShowUserMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                >
                  <User className="w-4 h-4" />
                  Profile Settings
                </button>
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </motion.div>
            )}
          </div>

          {/* Quick Stats */}
          <div className="glass-panel p-3 space-y-2">
            <div className="text-xs text-white/60 font-medium">Session Info</div>
            <div className="flex justify-between text-xs">
              <span className="text-white/60">Role:</span>
              <span className="text-white font-medium">{roleConfig.label}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-white/60">Department:</span>
              <span className="text-white font-medium">{userProfile.department || 'Security'}</span>
            </div>
            {userProfile.last_login && (
              <div className="flex justify-between text-xs">
                <span className="text-white/60">Last Login:</span>
                <span className="text-white font-medium">
                  {new Date(userProfile.last_login).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}