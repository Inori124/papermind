'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  Library, Network, StickyNote, PenTool,
  PanelLeftClose, PanelLeftOpen,
  Folder, FolderPlus, MoreHorizontal, Pencil, Trash2,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/', label: '文献库', icon: Library },
  { href: '/notes', label: '笔记', icon: StickyNote },
  { href: '/writing', label: '写作', icon: PenTool },
  { href: '/graph', label: '知识图谱', icon: Network },
];

export default function SidebarNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Folder state
  const [folders, setFolders] = useState<any[]>([]);
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [contextMenuFolder, setContextMenuFolder] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

  // Restore collapse state from localStorage on client mount
  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem('sidebar-collapsed');
      if (saved === 'true') setCollapsed(true);
    } catch {
      // localStorage unavailable, ignore
    }
  }, []);

  useEffect(() => {
    fetchFolders();
  }, []);

  async function fetchFolders() {
    try {
      const res = await fetch('/api/folders');
      const data = await res.json();
      setFolders(data);
    } catch {}
  }

  async function handleCreateFolder() {
    if (!newFolderName.trim()) return;
    await fetch('/api/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newFolderName }),
    });
    setNewFolderName('');
    setShowNewFolderInput(false);
    fetchFolders();
  }

  async function handleRenameFolder(id: string) {
    if (!editingName.trim()) return;
    await fetch('/api/folders', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name: editingName }),
    });
    setEditingFolderId(null);
    fetchFolders();
  }

  async function handleDeleteFolder(id: string) {
    await fetch(`/api/folders?id=${id}`, { method: 'DELETE' });
    setContextMenuFolder(null);
    fetchFolders();
  }

  function handleDropPaper(e: React.DragEvent, folderId: string) {
    e.preventDefault();
    setDragOverFolderId(null);
    const paperId = e.dataTransfer.getData('paperId');
    if (paperId) {
      fetch('/api/folders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paperId, folderId }),
      }).then(() => fetchFolders());
    }
  }

  function toggleCollapse() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem('sidebar-collapsed', String(next));
    } catch {
      // ignore
    }
  }

  function isActive(href: string) {
    if (href === '/') return pathname === '/' || pathname.startsWith('/reader');
    return pathname.startsWith(href);
  }

  // SSR: render expanded to avoid layout flash
  const isCollapsed = mounted ? collapsed : false;

  return (
    <aside
      className={`shrink-0 border-r border-border flex flex-col bg-background transition-[width] duration-200 ease-out overflow-hidden ${
        isCollapsed ? 'w-[56px]' : 'w-[240px]'
      }`}
      style={{ minWidth: isCollapsed ? 56 : 240 }}
    >
      {/* Header: logo + collapse toggle */}
      <div className={`flex items-center h-[64px] shrink-0 ${isCollapsed ? 'justify-center px-0' : 'justify-between px-4'}`}>
        {!isCollapsed && (
          <div className="min-w-0">
            <h1 className="text-base font-semibold tracking-tight truncate">PaperMind</h1>
            <p className="text-[11px] text-muted-foreground">论文精读助手</p>
          </div>
        )}
        <button
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
          onClick={toggleCollapse}
          title={isCollapsed ? '展开侧边栏' : '收起侧边栏'}
        >
          {isCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      {/* Navigation items */}
      <nav className={`flex-1 flex flex-col gap-0.5 ${isCollapsed ? 'px-1.5' : 'px-3'} mt-2`}>

        {/* 文献库 */}
        <Link
          href="/"
          title={isCollapsed ? '文献库' : undefined}
          className={`
            flex items-center rounded-lg transition-colors duration-150
            ${isCollapsed
              ? 'justify-center w-[38px] h-[38px] mx-auto'
              : 'gap-3 px-3 py-2'
            }
            ${isActive('/') && !searchParams.get('folder')
              ? 'bg-foreground/5 text-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-foreground/[0.03]'
            }
          `}
        >
          <Library
            size={18}
            strokeWidth={isActive('/') ? 2 : 1.5}
            className="shrink-0"
          />
          {!isCollapsed && (
            <span className={`text-sm truncate ${isActive('/') ? 'font-medium' : ''}`}>
              文献库
            </span>
          )}
        </Link>

        {/* ===== 文件夹子列表（只在展开状态下显示） ===== */}
        {!isCollapsed && (
          <div className="ml-[18px] pl-3 border-l border-border/50 mb-1">

            {/* 文件夹列表 */}
            {folders.map((folder) => (
              <div
                key={folder.id}
                className={`
                  group relative flex items-center gap-2 px-2 py-1.5 rounded-md text-xs cursor-pointer
                  transition-colors duration-100
                  ${dragOverFolderId === folder.id ? 'bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800' : ''}
                  ${searchParams.get('folder') === folder.id ? 'text-foreground bg-foreground/5' : 'text-muted-foreground hover:text-foreground hover:bg-foreground/[0.03]'}
                `}
                onClick={() => {
                  window.location.href = `/?folder=${folder.id}`;
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverFolderId(folder.id);
                }}
                onDragLeave={() => setDragOverFolderId(null)}
                onDrop={(e) => handleDropPaper(e, folder.id)}
              >
                {editingFolderId === folder.id ? (
                  <input
                    className="flex-1 text-xs bg-transparent border-b border-foreground/20 focus:outline-none py-0.5"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRenameFolder(folder.id);
                      if (e.key === 'Escape') setEditingFolderId(null);
                    }}
                    onBlur={() => handleRenameFolder(folder.id)}
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <>
                    <Folder size={14} className="shrink-0 opacity-50" />
                    <span className="flex-1 truncate">{folder.name}</span>
                    {folder.paperCount > 0 && (
                      <span className="text-[10px] opacity-40">{folder.paperCount}</span>
                    )}

                    <button
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-muted transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        setContextMenuFolder(contextMenuFolder === folder.id ? null : folder.id);
                      }}
                    >
                      <MoreHorizontal size={12} />
                    </button>
                  </>
                )}

                {/* 右键菜单 */}
                {contextMenuFolder === folder.id && (
                  <div
                    className="absolute right-0 top-full mt-1 bg-background border border-border rounded-md shadow-lg z-50 py-1 min-w-[100px]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted"
                      onClick={() => {
                        setEditingFolderId(folder.id);
                        setEditingName(folder.name);
                        setContextMenuFolder(null);
                      }}
                    >
                      <Pencil size={11} /> 重命名
                    </button>
                    <button
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                      onClick={() => handleDeleteFolder(folder.id)}
                    >
                      <Trash2 size={11} /> 删除
                    </button>
                  </div>
                )}
              </div>
            ))}

            {/* 新建文件夹 */}
            {showNewFolderInput ? (
              <div className="flex items-center gap-1.5 px-2 py-1.5">
                <Folder size={14} className="shrink-0 opacity-30" />
                <input
                  className="flex-1 text-xs bg-transparent border-b border-foreground/20 focus:outline-none py-0.5"
                  placeholder="文件夹名称"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateFolder();
                    if (e.key === 'Escape') setShowNewFolderInput(false);
                  }}
                  autoFocus
                />
              </div>
            ) : (
              <button
                className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors w-full"
                onClick={() => setShowNewFolderInput(true)}
              >
                <FolderPlus size={14} />
                <span>新建文件夹</span>
              </button>
            )}
          </div>
        )}

        {/* 其余导航项——笔记、写作、知识图谱 */}
        {NAV_ITEMS.filter(item => item.href !== '/').map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={isCollapsed ? item.label : undefined}
              className={`
                flex items-center rounded-lg transition-colors duration-150
                ${isCollapsed
                  ? 'justify-center w-[38px] h-[38px] mx-auto'
                  : 'gap-3 px-3 py-2'
                }
                ${active
                  ? 'bg-foreground/5 text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-foreground/[0.03]'
                }
              `}
            >
              <Icon
                size={18}
                strokeWidth={active ? 2 : 1.5}
                className="shrink-0"
              />
              {!isCollapsed && (
                <span className={`text-sm truncate ${active ? 'font-medium' : ''}`}>
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className={`shrink-0 border-t border-border py-3 ${isCollapsed ? 'px-1.5' : 'px-4'}`}>
        {!isCollapsed && (
          <p className="text-[11px] text-muted-foreground" id="sidebar-stats" />
        )}
      </div>
    </aside>
  );
}
