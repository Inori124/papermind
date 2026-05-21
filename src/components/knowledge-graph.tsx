'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import * as d3 from 'd3';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useGraph } from '@/hooks/use-graph';
import { Network } from 'lucide-react';
import type { GraphNode, GraphLink } from '@/types';

// 概念类别 → 颜色映射（低饱和色系，与 shadcn/ui 风格统一）
const CATEGORY_COLORS: Record<string, {
  fill: string; stroke: string; text: string; label: string;
}> = {
  method:  { fill: '#EEEDFE', stroke: '#AFA9EC', text: '#3C3489', label: '方法' },
  theory:  { fill: '#E1F5EE', stroke: '#5DCAA5', text: '#085041', label: '理论' },
  dataset: { fill: '#FAEEDA', stroke: '#FAC775', text: '#633806', label: '数据集' },
  metric:  { fill: '#FAECE7', stroke: '#F0997B', text: '#712B13', label: '指标' },
  finding: { fill: '#E6F1FB', stroke: '#85B7EB', text: '#0C447C', label: '发现' },
  tool:    { fill: '#F1EFE8', stroke: '#B4B2A9', text: '#444441', label: '工具' },
};

const DEFAULT_CATEGORY = { fill: '#F1EFE8', stroke: '#B4B2A9', text: '#444441', label: '' };

const RELATION_COLORS: Record<string, string> = {
  builds_on:    '#B4B2A9',
  contradicts:  '#F09595',
  applies:      '#5DCAA5',
  extends:      '#AFA9EC',
  compares:     '#FAC775',
  uses:         '#85B7EB',
};

const RELATION_LABELS: Record<string, string> = {
  builds_on:   '基于',
  contradicts: '矛盾',
  applies:     '应用',
  extends:     '扩展',
  compares:    '比较',
  uses:        '使用',
};

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  node: {
    name: string;
    category: string;
    description: string;
    papers?: { id: string; title: string }[];
  };
}

function getNodeName(nodeOrId: any): string {
  return typeof nodeOrId === 'object' ? nodeOrId.name : nodeOrId;
}

export default function KnowledgeGraph() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { data, loading } = useGraph();
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  // Filter data
  const filteredData = useCallback(() => {
    let nodes = data.nodes;
    let links = data.links;

    if (search) {
      const q = search.toLowerCase();
      const matchedIds = new Set(
        nodes.filter((n) => n.name.toLowerCase().includes(q)).map((n) => n.id)
      );
      nodes = nodes.filter((n) => matchedIds.has(n.id));
      links = links.filter(
        (l) => {
          const sid = typeof l.source === 'object' ? l.source.id : l.source;
          const tid = typeof l.target === 'object' ? l.target.id : l.target;
          return matchedIds.has(sid as string) && matchedIds.has(tid as string);
        }
      );
    }

    if (categoryFilter.size > 0) {
      const catIds = new Set(
        data.nodes.filter((n) => categoryFilter.has(n.category)).map((n) => n.id)
      );
      nodes = nodes.filter((n) => catIds.has(n.id));
      links = links.filter(
        (l) => {
          const sid = typeof l.source === 'object' ? l.source.id : l.source;
          const tid = typeof l.target === 'object' ? l.target.id : l.target;
          return catIds.has(sid as string) && catIds.has(tid as string);
        }
      );
    }

    return { nodes, links };
  }, [data, search, categoryFilter]);

  // Resize handler
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({ width: Math.max(width, 400), height: Math.max(height, 400) });
      }
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // D3 force simulation
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!svgRef.current || data.nodes.length === 0) return;

    const { nodes, links: graphLinks } = filteredData();
    if (nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const { width, height } = dimensions;

    const g = svg.append('g');

    // Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });
    svg.call(zoom);

    // Deep clone for D3 mutation
    const simNodes = nodes.map((n) => ({ ...n })) as any[];
    const simLinks = graphLinks.map((l) => ({ ...l })) as any[];

    // Simulation
    const simulation = d3.forceSimulation(simNodes)
      .force('link', d3.forceLink(simLinks).id((d: any) => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(20));

    // Links
    const linkGroup = g.append('g')
      .selectAll('line')
      .data(simLinks)
      .join('line')
      .attr('stroke', (d: any) => RELATION_COLORS[d.relationType] || '#B4B2A9')
      .attr('stroke-width', (d: any) => Math.max(d.strength * 2.5, 0.5))
      .attr('stroke-opacity', 0.5)
      .style('transition', 'opacity 0.2s')
      .style('cursor', 'pointer');

    // Link hover → relation type tooltip
    linkGroup
      .on('mouseover', function (event, d: any) {
        const containerRect = containerRef.current?.getBoundingClientRect();
        if (containerRect) {
          setTooltip({
            visible: true,
            x: event.clientX - containerRect.left,
            y: event.clientY - containerRect.top,
            node: {
              name: `${getNodeName(d.source)} → ${getNodeName(d.target)}`,
              category: '',
              description: [
                `关系：${RELATION_LABELS[d.relationType] || d.relationType}`,
                d.evidence ? `依据：${d.evidence}` : '',
              ].filter(Boolean).join('\n'),
              papers: [],
            },
          });
        }
        d3.select(this)
          .attr('stroke-opacity', 1)
          .attr('stroke-width', 3);
      })
      .on('mousemove', function (event) {
        const containerRect = containerRef.current?.getBoundingClientRect();
        if (containerRect && tooltip) {
          setTooltip((prev) => prev ? {
            ...prev,
            x: event.clientX - containerRect.left,
            y: event.clientY - containerRect.top,
          } : null);
        }
      })
      .on('mouseout', function () {
        setTooltip(null);
        d3.select(this)
          .attr('stroke-opacity', 0.5)
          .attr('stroke-width', (d: any) => Math.max(d.strength * 2.5, 0.5));
      });

    // Nodes
    const nodeGroup = g.append('g')
      .selectAll('g')
      .data(simNodes)
      .join('g')
      .call(
        (d3.drag<any, any>() as any)
          .on('start', (event: any, d: any) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event: any, d: any) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event: any, d: any) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    // Node circles
    nodeGroup.append('circle')
      .attr('r', (d: any) => Math.max(d.val, 6))
      .attr('fill', (d: any) => (CATEGORY_COLORS[d.category] || DEFAULT_CATEGORY).fill)
      .attr('stroke', (d: any) => (CATEGORY_COLORS[d.category] || DEFAULT_CATEGORY).stroke)
      .attr('stroke-width', 1.5)
      .style('cursor', 'pointer')
      .style('transition', 'opacity 0.2s');

    // Node labels
    nodeGroup.append('text')
      .text((d: any) => d.name)
      .attr('x', 0)
      .attr('y', (d: any) => Math.max(d.val, 6) + 14)
      .attr('text-anchor', 'middle')
      .attr('font-size', '11px')
      .attr('font-weight', '500')
      .attr('fill', (d: any) => (CATEGORY_COLORS[d.category] || DEFAULT_CATEGORY).text)
      .style('pointer-events', 'none');

    // Node click → select
    nodeGroup.on('click', (_event: any, d: any) => {
      setSelectedNode(d);
    });

    // Node double-click → navigate to first paper's reader
    nodeGroup.on('dblclick', (_event: any, d: any) => {
      if (d.papers && d.papers.length > 0) {
        router.push(`/reader/${d.papers[0].id}`);
      }
    });

    // Node hover → scale + highlight connected + tooltip
    nodeGroup
      .on('mouseover', function (event, d: any) {
        // 放大当前节点
        d3.select(this).select('circle')
          .transition().duration(150)
          .attr('r', (d: any) => Math.max(d.val, 6) * 1.3)
          .attr('stroke-width', 2.5);

        const connectedIds = new Set<string>();
        connectedIds.add(d.id);
        simLinks.forEach((link: any) => {
          const sid = typeof link.source === 'object' ? link.source.id : link.source;
          const tid = typeof link.target === 'object' ? link.target.id : link.target;
          if (sid === d.id) connectedIds.add(tid);
          if (tid === d.id) connectedIds.add(sid);
        });

        nodeGroup.style('opacity', (n: any) => connectedIds.has(n.id) ? 1 : 0.15);
        linkGroup.style('opacity', (l: any) => {
          const sid = typeof l.source === 'object' ? l.source.id : l.source;
          const tid = typeof l.target === 'object' ? l.target.id : l.target;
          return (sid === d.id || tid === d.id) ? 1 : 0.05;
        });

        const containerRect = containerRef.current?.getBoundingClientRect();
        if (containerRect) {
          setTooltip({
            visible: true,
            x: event.clientX - containerRect.left,
            y: event.clientY - containerRect.top,
            node: {
              name: d.name,
              category: d.category,
              description: d.description || '',
              papers: d.papers || [],
            },
          });
        }
      })
      .on('mousemove', function (event) {
        const containerRect = containerRef.current?.getBoundingClientRect();
        if (containerRect) {
          setTooltip((prev) => prev ? {
            ...prev,
            x: event.clientX - containerRect.left,
            y: event.clientY - containerRect.top,
          } : null);
        }
      })
      .on('mouseout', function () {
        // 恢复原始大小
        d3.select(this).select('circle')
          .transition().duration(150)
          .attr('r', (d: any) => Math.max(d.val, 6))
          .attr('stroke-width', 1.5);

        nodeGroup.style('opacity', 1);
        linkGroup.style('opacity', 1);
        setTooltip(null);
      });

    // Simulation tick
    simulation.on('tick', () => {
      linkGroup
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      nodeGroup.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
    };
  }, [data, dimensions, filteredData, router]);

  const toggleCategory = (cat: string) => {
    setCategoryFilter((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const hasData = data.nodes.length > 0;

  return (
    <div className="flex flex-col h-full relative">
      {/* Search + filter controls */}
      <div className="absolute top-4 left-[236px] z-20 flex items-center gap-3">
        <Input
          placeholder="搜索概念..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-48 h-8 text-xs bg-background shadow"
        />
        <div className="flex items-center gap-1">
          {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
            <button key={cat} onClick={() => toggleCategory(cat)}>
              <Badge
                variant={categoryFilter.has(cat) ? 'default' : 'outline'}
                className="cursor-pointer text-[10px] h-5"
                style={
                  categoryFilter.has(cat)
                    ? { backgroundColor: color.stroke, borderColor: color.stroke }
                    : {}
                }
              >
                {color.label}
              </Badge>
            </button>
          ))}
        </div>
      </div>

      {/* Graph container */}
      <div ref={containerRef} className="flex-1 relative">
        {/* Loading */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <Skeleton className="h-full w-full rounded-none" />
          </div>
        )}

        {/* Empty state */}
        {!loading && !hasData && (
          <div className="absolute inset-0 flex flex-col items-center justify-center animate-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
              <Network size={28} strokeWidth={1} className="text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground mb-1">知识图谱暂无数据</p>
            <p className="text-xs text-muted-foreground/60 max-w-[240px] text-center leading-relaxed">
              上传论文后系统会自动提取概念并构建关联网络
            </p>
          </div>
        )}

        {/* Unified panel: title + hint + legend */}
        {hasData && (
          <div className="absolute top-4 left-4 z-10 bg-background/90 backdrop-blur-sm border border-border rounded-lg p-4 max-w-[180px]">
            <h2 className="text-sm font-semibold mb-1">知识图谱</h2>
            <p className="text-[10px] text-muted-foreground mb-3">拖拽节点 · 滚轮缩放 · 悬停查看详情</p>
            <div className="h-px bg-border mb-3" />
            <p className="text-[10px] text-muted-foreground mb-2">概念类别</p>
            <div className="space-y-1.5">
              {Object.entries(CATEGORY_COLORS).map(([key, color]) => (
                <div key={key} className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: color.stroke }}
                  />
                  <span className="text-xs" style={{ color: color.text }}>
                    {color.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SVG */}
        <svg ref={svgRef} width="100%" height="100%" className="absolute inset-0" />

        {/* Tooltip */}
        {tooltip && tooltip.visible && (
          <div
            className="absolute z-50 pointer-events-none"
            style={{
              left: tooltip.x + 16,
              top: tooltip.y - 8,
              maxWidth: 280,
            }}
          >
            <div className="bg-background border border-border rounded-lg shadow-md p-3">
              {/* Name + category tag */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium">{tooltip.node.name}</span>
                {tooltip.node.category && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded"
                    style={{
                      background: (CATEGORY_COLORS[tooltip.node.category] || DEFAULT_CATEGORY).fill,
                      color: (CATEGORY_COLORS[tooltip.node.category] || DEFAULT_CATEGORY).text,
                    }}
                  >
                    {(CATEGORY_COLORS[tooltip.node.category] || DEFAULT_CATEGORY).label || tooltip.node.category}
                  </span>
                )}
              </div>

              {/* Description */}
              {tooltip.node.description && (
                <p className="text-xs text-muted-foreground mb-2 leading-relaxed whitespace-pre-line">
                  {tooltip.node.description}
                </p>
              )}

              {/* Paper list */}
              {tooltip.node.papers && tooltip.node.papers.length > 0 && (
                <div className="border-t border-border pt-2">
                  <p className="text-[10px] text-muted-foreground mb-1.5">
                    出现在 {tooltip.node.papers.length} 篇论文中
                  </p>
                  <div className="space-y-1">
                    {tooltip.node.papers.slice(0, 5).map((paper) => (
                      <div key={paper.id} className="flex items-start gap-1.5">
                        <span className="shrink-0 w-1 h-1 rounded-full bg-blue-400 mt-1.5" />
                        <span className="text-xs leading-snug line-clamp-2">
                          {paper.title}
                        </span>
                      </div>
                    ))}
                    {tooltip.node.papers.length > 5 && (
                      <p className="text-[10px] text-muted-foreground">
                        还有 {tooltip.node.papers.length - 5} 篇...
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Selected node detail panel */}
        {selectedNode && (
          <div className="absolute right-4 top-20 z-20 w-72">
            <div className="bg-background border border-border rounded-lg p-4 shadow-lg">
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="h-3 w-3 rounded-full shrink-0"
                  style={{
                    backgroundColor: (CATEGORY_COLORS[selectedNode.category] || DEFAULT_CATEGORY).stroke,
                  }}
                />
                <h4 className="font-semibold text-sm">{selectedNode.name}</h4>
              </div>
              <Badge
                variant="outline"
                className="text-[10px] h-4 mb-2"
                style={{
                  color: (CATEGORY_COLORS[selectedNode.category] || DEFAULT_CATEGORY).text,
                  borderColor: (CATEGORY_COLORS[selectedNode.category] || DEFAULT_CATEGORY).stroke,
                }}
              >
                {(CATEGORY_COLORS[selectedNode.category] || DEFAULT_CATEGORY).label || selectedNode.category}
              </Badge>
              {selectedNode.description && (
                <p className="text-xs text-muted-foreground mb-2 leading-relaxed">
                  {selectedNode.description}
                </p>
              )}
              <p className="text-xs text-muted-foreground mb-2">
                出现在 {selectedNode.paperCount} 篇论文中
              </p>
              {selectedNode.papers && selectedNode.papers.length > 0 && (
                <div className="border-t border-border pt-2 mb-3 space-y-1">
                  {selectedNode.papers.map((paper) => (
                    <button
                      key={paper.id}
                      className="block w-full text-left text-xs text-blue-600 hover:underline truncate"
                      onClick={() => router.push(`/reader/${paper.id}`)}
                    >
                      {paper.title}
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={() => setSelectedNode(null)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
