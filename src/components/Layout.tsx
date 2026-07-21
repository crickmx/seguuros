import { ReactNode, useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';

interface LayoutProps {
  children: ReactNode;
  title?: string;
}

export function Layout({ children, title }: LayoutProps) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getNavigationItems = () => {
    if (profile?.role === 'admin') {
      return [
        {
          icon: '📊',
          label: 'Dashboard',
          path: '/admin/dashboard',
          isActive: location.pathname.includes('/admin/dashboard')
        },
        {
          icon: '🧲',
          label: 'Leads',
          path: '/admin/prospectos',
          isActive: location.pathname.includes('/prospectos')
        },
        {
          icon: '💬',
          label: 'WhatsApp',
          path: '/admin/whatsapp',
          isActive: location.pathname.includes('/whatsapp')
        },
        {
          icon: '👥',
          label: 'Clientes',
          path: '/admin/clientes',
          isActive: location.pathname.includes('/clientes') && !location.pathname.includes('/admin/dashboard')
        },
        {
          icon: '📋',
          label: 'Seguimientos',
          path: '/admin/seguimientos',
          isActive: location.pathname.includes('/seguimientos')
        },
        {
          icon: '👤',
          label: 'Usuarios',
          path: '/admin/users',
          isActive: location.pathname.includes('/users')
        },
        {
          icon: '📧',
          label: 'Leads Email',
          path: '/admin/leads-email',
          isActive: location.pathname.includes('/leads-email')
        },
        {
          icon: '⚙️',
          label: 'Configuración',
          path: '/admin/settings',
          isActive: location.pathname.includes('/settings')
        }
      ];
    } else if (profile?.role === 'ejecutivo') {
      return [
        {
          icon: '🧲',
          label: 'Leads',
          path: '/ejecutivo/crm',
          isActive: location.pathname.includes('/crm')
        },
        {
          icon: '💬',
          label: 'WhatsApp',
          path: '/ejecutivo/whatsapp',
          isActive: location.pathname.includes('/whatsapp')
        },
        {
          icon: '👥',
          label: 'Clientes',
          path: '/ejecutivo/clientes',
          isActive: location.pathname.includes('/clientes')
        },
        {
          icon: '📋',
          label: 'Seguimientos',
          path: '/ejecutivo/seguimientos',
          isActive: location.pathname.includes('/seguimientos')
        },
        {
          icon: '👤',
          label: 'Perfil',
          path: '/ejecutivo/perfil',
          isActive: location.pathname.includes('/perfil')
        }
      ];
    } else if (profile?.role === 'cliente') {
      return [
        {
          icon: '📄',
          label: 'Mis Seguros',
          path: '/cliente',
          isActive: location.pathname === '/cliente'
        },
        {
          icon: '💬',
          label: 'Ayuda',
          path: '/cliente/help',
          isActive: location.pathname.includes('/help')
        }
      ];
    }
    return [];
  };

  const navigationItems = getNavigationItems();
  const currentPageTitle = title || navigationItems.find(item => item.isActive)?.label || 'Seguuros';

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: '#F7F8FC'
    }}>
      {!isMobile && profile?.role !== 'cliente' && (
        <aside style={{
          width: '260px',
          background: '#202856',
          color: '#FFFFFF',
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          zIndex: 100,
          boxShadow: '2px 0 10px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{
            padding: '24px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <img
              src="/logo_seguuros.png"
              alt="Seguuros"
              style={{
                height: '32px',
                width: 'auto',
                objectFit: 'contain'
              }}
            />
          </div>

          <nav style={{
            flex: 1,
            padding: '16px 12px',
            overflowY: 'auto'
          }}>
            {navigationItems.map((item, index) => (
              <button
                key={index}
                onClick={() => navigate(item.path)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  margin: '4px 0',
                  background: item.isActive ? 'rgba(101, 234, 30, 0.15)' : 'transparent',
                  color: item.isActive ? '#65EA1E' : 'rgba(255, 255, 255, 0.7)',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '15px',
                  fontWeight: item.isActive ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  textAlign: 'left'
                }}
                onMouseEnter={(e) => {
                  if (!item.isActive) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    e.currentTarget.style.color = '#FFFFFF';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!item.isActive) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
                  }
                }}
              >
                <span style={{ fontSize: '20px' }}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <div style={{
            padding: '16px 20px',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '12px'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #65EA1E 0%, #017E7B 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                fontWeight: 600
              }}>
                {profile?.full_name ? getInitials(profile.full_name) : '?'}
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {profile?.full_name}
                </div>
                <div style={{
                  fontSize: '12px',
                  color: 'rgba(255, 255, 255, 0.6)',
                  textTransform: 'capitalize'
                }}>
                  {profile?.role}
                </div>
              </div>
            </div>
            <button
              onClick={() => signOut()}
              style={{
                width: '100%',
                padding: '10px 16px',
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#EF4444',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#EF4444';
                e.currentTarget.style.color = '#FFFFFF';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                e.currentTarget.style.color = '#EF4444';
              }}
            >
              Cerrar sesión
            </button>
          </div>
        </aside>
      )}

      <div style={{
        flex: 1,
        marginLeft: !isMobile && profile?.role !== 'cliente' ? '260px' : 0,
        display: 'flex',
        flexDirection: 'column'
      }}>
        <header style={{
          position: 'sticky',
          top: 0,
          zIndex: 90,
          background: '#FFFFFF',
          borderBottom: '1px solid #E6E8EF',
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: '64px'
        }}>
          {profile?.role === 'cliente' ? (
            <>
              <div style={{ width: '40px' }} />
              <img
                src="/logo_seguuros_b.png"
                alt="Seguuros"
                style={{
                  height: '32px',
                  width: 'auto',
                  objectFit: 'contain'
                }}
              />
            </>
          ) : (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px'
            }}>
              {isMobile && (
                <button
                  onClick={() => setShowMobileMenu(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '24px',
                    cursor: 'pointer',
                    color: '#202856',
                    padding: '8px',
                    minWidth: '40px',
                    minHeight: '40px'
                  }}
                >
                  ☰
                </button>
              )}
              <h1 style={{
                fontSize: '20px',
                fontWeight: 600,
                color: '#202856',
                margin: 0
              }}>
                {currentPageTitle}
              </h1>
            </div>
          )}

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            position: 'relative'
          }}>
            <div
              onClick={() => setShowUserMenu(!showUserMenu)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                cursor: 'pointer',
                padding: '6px 12px 6px 6px',
                borderRadius: '12px',
                transition: 'all 0.2s ease',
                background: showUserMenu ? '#F7F8FC' : 'transparent'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#F7F8FC'}
              onMouseLeave={(e) => e.currentTarget.style.background = showUserMenu ? '#F7F8FC' : 'transparent'}
            >
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #194988 0%, #017E7B 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: 600,
                color: '#FFFFFF'
              }}>
                {profile?.full_name ? getInitials(profile.full_name) : '?'}
              </div>
              {!isMobile && profile?.role !== 'cliente' && (
                <span style={{
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#202856',
                  maxWidth: '150px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {profile?.full_name?.split(' ')[0]}
                </span>
              )}
            </div>

            {showUserMenu && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '8px',
                background: '#FFFFFF',
                borderRadius: '12px',
                boxShadow: '0 4px 20px rgba(32, 40, 86, 0.15)',
                border: '1px solid #E6E8EF',
                minWidth: '220px',
                overflow: 'hidden',
                zIndex: 100
              }}>
                <div style={{
                  padding: '16px',
                  borderBottom: '1px solid #E6E8EF'
                }}>
                  <div style={{
                    fontSize: '15px',
                    fontWeight: 600,
                    color: '#202856',
                    marginBottom: '4px'
                  }}>
                    {profile?.full_name}
                  </div>
                  <div style={{
                    fontSize: '13px',
                    color: '#718096',
                    textTransform: 'capitalize'
                  }}>
                    {profile?.role}
                  </div>
                </div>

                {profile?.role === 'admin' && (
                  <button
                    onClick={() => {
                      navigate('/admin/dashboard');
                      setShowUserMenu(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      background: 'transparent',
                      border: 'none',
                      textAlign: 'left',
                      fontSize: '14px',
                      color: '#202856',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#F7F8FC'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <span>🔧</span>
                    <span>Panel Admin</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    signOut();
                    setShowUserMenu(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: 'transparent',
                    border: 'none',
                    textAlign: 'left',
                    fontSize: '14px',
                    color: '#EF4444',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.05)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <span>🚪</span>
                  <span>Cerrar sesión</span>
                </button>
              </div>
            )}
          </div>
        </header>

        <main style={{
          flex: 1,
          padding: isMobile ? '16px' : '24px 32px',
          maxWidth: '1600px',
          width: '100%',
          margin: '0 auto'
        }}>
          {children}
        </main>
      </div>

      {showMobileMenu && (
        <div
          onClick={() => setShowMobileMenu(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 200,
            animation: 'fadeIn 0.2s ease'
          }}
        >
          <aside
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '280px',
              background: '#202856',
              color: '#FFFFFF',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              animation: 'slideInFromLeft 0.3s ease'
            }}
          >
            <div style={{
              padding: '20px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <img
                src="/logo_seguuros.png"
                alt="Seguuros"
                style={{
                  height: '32px',
                  width: 'auto',
                  objectFit: 'contain'
                }}
              />
              <button
                onClick={() => setShowMobileMenu(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '28px',
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  padding: '4px',
                  lineHeight: 1
                }}
              >
                ×
              </button>
            </div>

            <nav style={{
              flex: 1,
              padding: '16px 12px',
              overflowY: 'auto'
            }}>
              {navigationItems.map((item, index) => (
                <button
                  key={index}
                  onClick={() => {
                    navigate(item.path);
                    setShowMobileMenu(false);
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '14px 16px',
                    margin: '4px 0',
                    background: item.isActive ? 'rgba(101, 234, 30, 0.15)' : 'transparent',
                    color: item.isActive ? '#65EA1E' : 'rgba(255, 255, 255, 0.7)',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '15px',
                    fontWeight: item.isActive ? 600 : 500,
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <span style={{ fontSize: '22px' }}>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>

            <div style={{
              padding: '16px 20px',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '12px'
              }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #65EA1E 0%, #017E7B 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px',
                  fontWeight: 600
                }}>
                  {profile?.full_name ? getInitials(profile.full_name) : '?'}
                </div>
                <div>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: 600
                  }}>
                    {profile?.full_name}
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: 'rgba(255, 255, 255, 0.6)',
                    textTransform: 'capitalize'
                  }}>
                    {profile?.role}
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  signOut();
                  setShowMobileMenu(false);
                }}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: '#EF4444',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cerrar sesión
              </button>
            </div>
          </aside>
        </div>
      )}

      {showUserMenu && (
        <div
          onClick={() => setShowUserMenu(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 80
          }}
        />
      )}
    </div>
  );
}
