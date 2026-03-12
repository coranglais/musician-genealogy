import { useEffect, useRef, useState, useCallback } from 'react'
import * as d3 from 'd3'
import { getMusicianLineage } from '../api'
import { useNavigate } from 'react-router-dom'

const NODE_WIDTH = 180
const NODE_HEIGHT = 64
const VERTICAL_SPACING = 120
const HORIZONTAL_SPACING = 220

const PRIMARY_TYPES = new Set(['formal_study', 'private_study', 'apprenticeship'])
const SECONDARY_TYPES = new Set(['festival', 'informal'])

function getVisualWeight(relType) {
  if (PRIMARY_TYPES.has(relType)) return 'primary'
  if (SECONDARY_TYPES.has(relType)) return 'secondary'
  return 'tertiary'
}

function getStrokeDash(weight) {
  if (weight === 'primary') return 'none'
  if (weight === 'secondary') return '8,4'
  return '3,3'
}

function getStrokeWidth(weight) {
  if (weight === 'primary') return 2.5
  if (weight === 'secondary') return 2
  return 1.5
}

function getStrokeColor(weight) {
  if (weight === 'primary') return '#92400e'
  if (weight === 'secondary') return '#0369a1'
  return '#7c3aed'
}

function formatNodeDates(m) {
  if (!m.birth_date && !m.death_date) return ''
  return `${m.birth_date || '?'}–${m.death_date || ''}`
}

function truncateText(text, maxLen) {
  if (!text || text.length <= maxLen) return text
  return text.slice(0, maxLen - 1) + '\u2026'
}

// Transform API lineage data into d3-compatible hierarchy nodes.
// We fetch one level deeper than we render (fetchDepth = renderDepth + 1).
// Nodes at renderDepth with children in the API response are expandable;
// nodes at renderDepth with no children are provably terminal.
// The extra-depth nodes themselves are not included in the output.
function buildTreeData(apiData, direction, renderDepth) {
  const root = apiData.root
  const branches = direction === 'ancestors' ? apiData.ancestors : apiData.descendants

  function processNodes(nodes) {
    return nodes
      .filter(n => n.depth <= renderDepth)
      .map(n => {
        const children = processNodes(n.children || [])
        // At the render boundary: terminal if the API found no children
        // beyond this level (we fetched renderDepth+1 so we know for sure).
        // Below the boundary: terminal if no children at all.
        const hasChildrenBeyond = (n.children || []).length > 0
        const isTerminal = n.depth >= renderDepth ? !hasChildrenBeyond : children.length === 0
        return {
          id: n.musician.id,
          musician: n.musician,
          name: `${n.musician.first_name} ${n.musician.last_name}`,
          relationshipType: n.relationship_type,
          visualWeight: n.visual_weight || getVisualWeight(n.relationship_type),
          institution: n.institution,
          terminal: isTerminal,
          children,
        }
      })
  }

  return {
    id: root.id,
    musician: root,
    name: `${root.first_name} ${root.last_name}`,
    isRoot: true,
    terminal: false,
    children: processNodes(branches),
  }
}

export default function LineageTree({ musicianId, musicianName }) {
  const svgRef = useRef(null)
  const containerRef = useRef(null)
  const [showAll, setShowAll] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [ancestorData, setAncestorData] = useState(null)
  const [descendantData, setDescendantData] = useState(null)
  const [expandedNodes, setExpandedNodes] = useState(new Set())
  const [terminalNodes, setTerminalNodes] = useState(new Set())
  const navigate = useNavigate()
  const zoomRef = useRef(null)
  const RENDER_DEPTH = 2
  const FETCH_DEPTH = RENDER_DEPTH + 1 // over-fetch by 1 for terminal detection

  // Load initial lineage data
  useEffect(() => {
    setLoading(true)
    setError(null)
    setExpandedNodes(new Set())
    setTerminalNodes(new Set())
    getMusicianLineage(musicianId, FETCH_DEPTH, showAll)
      .then(data => {
        setAncestorData(buildTreeData(data, 'ancestors', RENDER_DEPTH))
        setDescendantData(buildTreeData(data, 'descendants', RENDER_DEPTH))
      })
      .catch(() => setError('Failed to load lineage data'))
      .finally(() => setLoading(false))
  }, [musicianId, showAll])

  // Expand a node by loading its teachers/students
  const expandNode = useCallback(async (nodeId, direction) => {
    const key = `${nodeId}-${direction}`
    if (expandedNodes.has(key) || terminalNodes.has(key)) return

    try {
      // Fetch 2 levels: 1 to render + 1 to detect terminal status
      const data = await getMusicianLineage(nodeId, 2, showAll)
      const newBranches = direction === 'ancestors' ? data.ancestors : data.descendants

      // If the API returned nothing, this node is terminal
      if (newBranches.length === 0) {
        setTerminalNodes(prev => new Set([...prev, key]))
        const markTerminal = (tree) => {
          if (!tree) return tree
          const update = (node) => {
            if (node.id === nodeId) return { ...node, terminal: true }
            return { ...node, children: node.children.map(update) }
          }
          return update(tree)
        }
        if (direction === 'ancestors') {
          setAncestorData(prev => markTerminal(prev))
        } else {
          setDescendantData(prev => markTerminal(prev))
        }
        return
      }

      const updateTree = (tree) => {
        if (!tree) return tree
        const updateNode = (node) => {
          if (node.id === nodeId) {
            const existingChildIds = new Set(node.children.map(c => c.id))
            const newChildren = newBranches
              .filter(n => !existingChildIds.has(n.musician.id))
              .map(n => {
                // depth=1 nodes from this expansion — use their children
                // (depth=2 probe) to determine terminal status
                const hasMore = (n.children || []).length > 0
                return {
                  id: n.musician.id,
                  musician: n.musician,
                  name: `${n.musician.first_name} ${n.musician.last_name}`,
                  relationshipType: n.relationship_type,
                  visualWeight: n.visual_weight || getVisualWeight(n.relationship_type),
                  institution: n.institution,
                  terminal: !hasMore,
                  children: [],
                }
              })
            return { ...node, children: [...node.children, ...newChildren] }
          }
          return { ...node, children: node.children.map(updateNode) }
        }
        return updateNode(tree)
      }

      if (direction === 'ancestors') {
        setAncestorData(prev => updateTree(prev))
      } else {
        setDescendantData(prev => updateTree(prev))
      }
      setExpandedNodes(prev => new Set([...prev, key]))
    } catch {
      // silently fail on expansion
    }
  }, [expandedNodes, terminalNodes, showAll])

  // Render the D3 tree
  useEffect(() => {
    if (!ancestorData || !descendantData || !svgRef.current || !containerRef.current) return

    const container = containerRef.current
    const width = container.clientWidth
    const height = container.clientHeight
    if (width === 0 || height === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    svg.attr('width', width).attr('height', height)

    const g = svg.append('g')

    // Setup zoom
    const zoom = d3.zoom()
      .scaleExtent([0.15, 3])
      .on('zoom', (event) => g.attr('transform', event.transform))
    svg.call(zoom)
    zoomRef.current = zoom

    // Build d3 hierarchies
    const ancestorHierarchy = d3.hierarchy(ancestorData, d => d.children)
    const descendantHierarchy = d3.hierarchy(descendantData, d => d.children)

    const ancestorLeaves = Math.max(ancestorHierarchy.leaves().length, 1)
    const descendantLeaves = Math.max(descendantHierarchy.leaves().length, 1)
    const maxLeaves = Math.max(ancestorLeaves, descendantLeaves)
    const treeWidth = Math.max(maxLeaves * HORIZONTAL_SPACING, width * 0.5)

    // Layout ancestors (going upward)
    const ancestorDepth = ancestorHierarchy.height
    const ancestorTreeH = Math.max(ancestorDepth * VERTICAL_SPACING, 1)
    d3.tree().size([treeWidth, ancestorTreeH])
      .separation((a, b) => a.parent === b.parent ? 1 : 1.2)(ancestorHierarchy)

    // Layout descendants (going downward)
    const descendantDepth = descendantHierarchy.height
    const descendantTreeH = Math.max(descendantDepth * VERTICAL_SPACING, 1)
    d3.tree().size([treeWidth, descendantTreeH])
      .separation((a, b) => a.parent === b.parent ? 1 : 1.2)(descendantHierarchy)

    const rootX = treeWidth / 2
    const offsetX = width / 2 - rootX

    // Flip ancestor Y to go upward from root
    ancestorHierarchy.each(node => {
      node.renderX = node.depth === 0 ? rootX : node.x
      node.renderY = node.depth === 0 ? 0 : -node.y
    })
    descendantHierarchy.each(node => {
      node.renderX = node.depth === 0 ? rootX : node.x
      node.renderY = node.depth === 0 ? 0 : node.y
    })

    // --- Draw links ---
    function drawLinks(hierarchy, direction) {
      const links = hierarchy.links().filter(l => l.target.depth > 0)
      g.append('g').attr('class', `links-${direction}`)
        .selectAll('path')
        .data(links)
        .enter()
        .append('path')
        .attr('d', d => {
          const sx = d.source.renderX + offsetX
          const sy = d.source.renderY
          const tx = d.target.renderX + offsetX
          const ty = d.target.renderY
          const midY = (sy + ty) / 2
          return `M${sx},${sy} C${sx},${midY} ${tx},${midY} ${tx},${ty}`
        })
        .attr('fill', 'none')
        .attr('stroke', d => getStrokeColor(d.target.data.visualWeight || 'primary'))
        .attr('stroke-width', d => getStrokeWidth(d.target.data.visualWeight || 'primary'))
        .attr('stroke-dasharray', d => getStrokeDash(d.target.data.visualWeight || 'primary'))
        .attr('opacity', 0.7)
    }

    drawLinks(ancestorHierarchy, 'ancestor')
    drawLinks(descendantHierarchy, 'descendant')

    // --- Draw nodes ---
    function drawNodes(hierarchy, direction) {
      // For ancestors, skip the root node (descendant tree draws it)
      const nodes = direction === 'ancestor'
        ? hierarchy.descendants().filter(n => n.depth > 0)
        : hierarchy.descendants()

      const nodeGroup = g.append('g').attr('class', `nodes-${direction}`)
        .selectAll('g')
        .data(nodes)
        .enter()
        .append('g')
        .attr('transform', d => `translate(${d.renderX + offsetX},${d.renderY})`)

      // Card background
      nodeGroup.append('rect')
        .attr('x', -NODE_WIDTH / 2)
        .attr('y', -NODE_HEIGHT / 2)
        .attr('width', NODE_WIDTH)
        .attr('height', NODE_HEIGHT)
        .attr('rx', 10)
        .attr('fill', d => d.data.isRoot ? '#fef3c7' : '#ffffff')
        .attr('stroke', d => d.data.isRoot ? '#d97706' : '#d6d3d1')
        .attr('stroke-width', d => d.data.isRoot ? 2.5 : 1.5)
        .attr('cursor', 'pointer')
        .style('filter', 'drop-shadow(0 1px 2px rgba(0,0,0,0.08))')

      // Name text
      nodeGroup.append('text')
        .attr('text-anchor', 'middle')
        .attr('y', -6)
        .attr('font-size', '13px')
        .attr('font-weight', '600')
        .attr('fill', d => d.data.isRoot ? '#92400e' : '#1c1917')
        .attr('pointer-events', 'none')
        .text(d => truncateText(d.data.name, 22))

      // Dates text
      nodeGroup.append('text')
        .attr('text-anchor', 'middle')
        .attr('y', 12)
        .attr('font-size', '11px')
        .attr('fill', '#78716c')
        .attr('pointer-events', 'none')
        .text(d => formatNodeDates(d.data.musician))

      // Expand "+" button on leaf nodes that aren't terminal (not root)
      nodeGroup.each(function (d) {
        if (d.data.isRoot) return
        const isLeaf = !d.children || d.children.length === 0
        if (!isLeaf || d.data.terminal) return

        const btnY = direction === 'ancestor' ? -NODE_HEIGHT / 2 - 12 : NODE_HEIGHT / 2 + 12
        const btnGroup = d3.select(this).append('g')
          .attr('class', 'expand-btn')
          .attr('cursor', 'pointer')

        btnGroup.append('circle')
          .attr('cx', 0).attr('cy', btnY).attr('r', 10)
          .attr('fill', '#f5f5f4')
          .attr('stroke', '#a8a29e')
          .attr('stroke-width', 1)

        btnGroup.append('text')
          .attr('text-anchor', 'middle')
          .attr('x', 0).attr('y', btnY + 4)
          .attr('font-size', '14px')
          .attr('font-weight', '600')
          .attr('fill', '#78716c')
          .attr('pointer-events', 'none')
          .text('+')

        btnGroup.on('click', (event) => {
          event.stopPropagation()
          expandNode(d.data.id, direction === 'ancestor' ? 'ancestors' : 'descendants')
        })

        btnGroup
          .on('mouseenter', function () {
            d3.select(this).select('circle').attr('fill', '#e7e5e4').attr('stroke', '#78716c')
          })
          .on('mouseleave', function () {
            d3.select(this).select('circle').attr('fill', '#f5f5f4').attr('stroke', '#a8a29e')
          })
      })

      // Click on node card -> navigate
      nodeGroup.on('click', function (event, d) {
        // Ignore if the expand button was clicked (it stops propagation)
        if (d.data.isRoot) return
        navigate(`/musician/${d.data.id}`)
      })

      // Hover effects on card
      nodeGroup
        .on('mouseenter', function (event, d) {
          d3.select(this).select('rect')
            .transition().duration(150)
            .attr('stroke', '#d97706')
            .attr('stroke-width', 2.5)
            .style('filter', 'drop-shadow(0 4px 6px rgba(0,0,0,0.12))')
        })
        .on('mouseleave', function (event, d) {
          d3.select(this).select('rect')
            .transition().duration(150)
            .attr('stroke', d.data.isRoot ? '#d97706' : '#d6d3d1')
            .attr('stroke-width', d.data.isRoot ? 2.5 : 1.5)
            .style('filter', 'drop-shadow(0 1px 2px rgba(0,0,0,0.08))')
        })
    }

    drawNodes(ancestorHierarchy, 'ancestor')
    drawNodes(descendantHierarchy, 'descendant')

    // Direction labels near the root
    if (ancestorDepth > 0) {
      g.append('text')
        .attr('x', rootX + offsetX)
        .attr('y', -VERTICAL_SPACING * 0.35)
        .attr('text-anchor', 'middle')
        .attr('font-size', '11px')
        .attr('font-weight', '500')
        .attr('fill', '#a8a29e')
        .text('\u2191 Teachers')
    }
    if (descendantDepth > 0) {
      g.append('text')
        .attr('x', rootX + offsetX)
        .attr('y', VERTICAL_SPACING * 0.35)
        .attr('text-anchor', 'middle')
        .attr('font-size', '11px')
        .attr('font-weight', '500')
        .attr('fill', '#a8a29e')
        .text('\u2193 Students')
    }

    // Auto-fit the tree in view
    const totalH = (ancestorDepth > 0 ? ancestorDepth * VERTICAL_SPACING : 0)
                  + (descendantDepth > 0 ? descendantDepth * VERTICAL_SPACING : 0)
                  + NODE_HEIGHT * 2

    const scale = Math.min(
      width / (treeWidth + HORIZONTAL_SPACING),
      height / (totalH + VERTICAL_SPACING),
      1,
    )
    const clampedScale = Math.max(scale, 0.3)

    const centerX = width / 2
    const ancestorH = ancestorDepth > 0 ? ancestorDepth * VERTICAL_SPACING : 0
    const descendantH = descendantDepth > 0 ? descendantDepth * VERTICAL_SPACING : 0
    const centerY = height / 2 + (ancestorH - descendantH) * clampedScale / 2

    svg.call(
      zoom.transform,
      d3.zoomIdentity
        .translate(centerX, centerY)
        .scale(clampedScale)
        .translate(-rootX - offsetX, 0),
    )

  }, [ancestorData, descendantData, expandNode, navigate])

  // Handle resize
  useEffect(() => {
    let timer
    const handleResize = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        if (ancestorData && descendantData) {
          setAncestorData(prev => ({ ...prev }))
        }
      }, 200)
    }
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      clearTimeout(timer)
    }
  }, [ancestorData, descendantData])

  const resetZoom = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return
    const svg = d3.select(svgRef.current)
    const w = +svg.attr('width')
    const h = +svg.attr('height')
    svg.transition().duration(500).call(
      zoomRef.current.transform,
      d3.zoomIdentity.translate(w / 2, h / 2).scale(0.6),
    )
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 rounded-xl border border-stone-200 bg-white">
        <div className="text-stone-400">Loading lineage tree...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96 rounded-xl border border-stone-200 bg-white">
        <div className="text-stone-400">{error}</div>
      </div>
    )
  }

  const hasTree = (ancestorData?.children?.length > 0) || (descendantData?.children?.length > 0)

  if (!hasTree) {
    return (
      <div className="flex items-center justify-center h-64 rounded-xl border border-stone-200 bg-white">
        <p className="text-stone-400">No lineage connections found for this musician.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-stone-200 px-4 py-2.5 bg-stone-50">
        <div className="flex items-center gap-4">
          <h3 className="text-sm font-semibold text-stone-600 tracking-wide uppercase">
            Lineage Tree
          </h3>
          <div className="flex items-center gap-3 text-xs text-stone-500">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-5 h-0.5 bg-amber-700"></span> Primary
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-5 h-0.5 border-t-2 border-dashed border-sky-700"></span> Secondary
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-5 h-0.5 border-t-2 border-dotted border-violet-600"></span> Tertiary
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <span className="text-xs text-stone-500">Show all connections</span>
            <button
              role="switch"
              aria-checked={showAll}
              onClick={() => setShowAll(prev => !prev)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                showAll ? 'bg-amber-600' : 'bg-stone-300'
              }`}
            >
              <span
                className="inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform"
                style={{ transform: showAll ? 'translateX(18px)' : 'translateX(2px)' }}
              />
            </button>
          </label>
          <button
            onClick={resetZoom}
            className="rounded px-2 py-1 text-xs text-stone-500 hover:bg-stone-200 hover:text-stone-700 transition-colors"
            title="Reset zoom"
          >
            Reset view
          </button>
        </div>
      </div>

      {/* Tree canvas */}
      <div ref={containerRef} className="relative h-[550px] bg-stone-50/50 cursor-grab active:cursor-grabbing">
        <svg ref={svgRef} className="w-full h-full" />
        <div className="absolute bottom-3 right-3 text-xs text-stone-400">
          Scroll to zoom &middot; Drag to pan &middot; Click node to visit &middot; Click + to expand
        </div>
      </div>
    </div>
  )
}
