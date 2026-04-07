import { useEffect, useMemo, useRef } from "react";
import * as d3 from "d3";
import type { GraphEdge } from "@socioatlas/shared";

type VisualNode = {
  id: string;
  label: string;
  node_type: "run" | "stage" | "agent" | "group";
  color: string;
  size: number;
  showLabel?: boolean;
  x?: number;
  y?: number;
};

type GraphNodeDatum = VisualNode & d3.SimulationNodeDatum;

type EdgeDatum = {
  id: string;
  source: string | GraphNodeDatum;
  target: string | GraphNodeDatum;
  color: string;
  width: number;
  pairTotal: number;
  pairIndex: number;
  isSelfLoop: boolean;
};

type GraphLinkDatum = EdgeDatum & d3.SimulationLinkDatum<GraphNodeDatum>;

type CoalitionGraphD3Props = {
  nodes: VisualNode[];
  edges: GraphEdge[];
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  resetToken: number;
};

function pairKey(source: string, target: string) {
  return source < target ? `${source}|${target}` : `${target}|${source}`;
}

function edgeStroke(edgeType: GraphEdge["edge_type"]) {
  if (edgeType === "MEMBER_OF") return "#aab4c7";
  if (edgeType === "ALIGNS_WITH" || edgeType === "COOPERATES_WITH") return "#6cbf9b";
  if (edgeType === "CONFLICTS_WITH" || edgeType === "COMPETES_WITH") return "#ef8d62";
  return "#b7bfcd";
}

export function CoalitionGraphD3(props: CoalitionGraphD3Props) {
  const { nodes, edges, selectedNodeId, onSelectNode, resetToken } = props;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const previousPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  const nodesById = useMemo(() => {
    return new Map(nodes.map((node) => [node.id, node] as const));
  }, [nodes]);

  useEffect(() => {
    if (!containerRef.current || !nodes.length) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;
    const cx = width / 2;
    const cy = height / 2;
    const projectX = (node: VisualNode, index: number) =>
      node.x !== undefined
        ? cx + node.x * 40
        : Math.cos((index / Math.max(nodes.length, 1)) * Math.PI * 2) * 220 + cx;
    const projectY = (node: VisualNode, index: number) =>
      node.y !== undefined
        ? cy + node.y * 34
        : Math.sin((index / Math.max(nodes.length, 1)) * Math.PI * 2) * 180 + cy;

    const graphNodes: GraphNodeDatum[] = nodes.map((node, index) => ({
      ...node,
      x: previousPositionsRef.current.get(node.id)?.x ?? projectX(node, index),
      y: previousPositionsRef.current.get(node.id)?.y ?? projectY(node, index),
    }));
    const targetPositionById = new Map(
      nodes.map((node, index) => [node.id, { x: projectX(node, index), y: projectY(node, index) }] as const),
    );

    const pairCounts = new Map<string, number>();
    edges.forEach((edge) => {
      const key = pairKey(edge.source, edge.target);
      pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
    });

    const pairIndexMap = new Map<string, number>();
    const graphEdges: EdgeDatum[] = edges
      .filter((edge) => nodesById.has(edge.source) && nodesById.has(edge.target))
      .map((edge) => {
        const key = pairKey(edge.source, edge.target);
        const pairIndex = pairIndexMap.get(key) ?? 0;
        pairIndexMap.set(key, pairIndex + 1);
        return {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          color: edgeStroke(edge.edge_type),
          width: edge.edge_type === "MEMBER_OF" ? 1.15 : 2,
          pairTotal: pairCounts.get(key) ?? 1,
          pairIndex,
          isSelfLoop: edge.source === edge.target,
        };
      });

    const svg = d3
      .select(container)
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .style("cursor", "grab");

    const root = svg.append("g");
    const edgeLayer = root.append("g").attr("class", "d3-edges");
    const nodeLayer = root.append("g").attr("class", "d3-nodes");
    const labelLayer = root.append("g").attr("class", "d3-labels");

    const simulation = d3
      .forceSimulation(graphNodes)
      .force(
        "link",
        d3
          .forceLink<GraphNodeDatum, GraphLinkDatum>(graphEdges as GraphLinkDatum[])
          .id((node: GraphNodeDatum) => node.id)
          .distance((edge: GraphLinkDatum) => {
            const base = edge.width > 1.2 ? 146 : 118;
            return base + (edge.pairTotal - 1) * 18;
          })
          .strength((edge: GraphLinkDatum) => (edge.width > 1.2 ? 0.08 : 0.05)),
      )
      .force("charge", d3.forceManyBody<GraphNodeDatum>().strength(-940))
      .force(
        "collide",
        d3
          .forceCollide<GraphNodeDatum>()
          .radius((node: GraphNodeDatum) => node.size + 17)
          .strength(0.98),
      )
      .force("center", d3.forceCenter<GraphNodeDatum>(cx, cy))
      .force(
        "x",
        d3
          .forceX<GraphNodeDatum>((node: GraphNodeDatum) => targetPositionById.get(node.id)?.x ?? cx)
          .strength((node: GraphNodeDatum) => (node.node_type === "group" ? 0.22 : 0.14)),
      )
      .force(
        "y",
        d3
          .forceY<GraphNodeDatum>((node: GraphNodeDatum) => targetPositionById.get(node.id)?.y ?? cy)
          .strength((node: GraphNodeDatum) => (node.node_type === "group" ? 0.22 : 0.14)),
      );

    const linkPath = edgeLayer
      .selectAll<SVGPathElement, EdgeDatum>("path")
      .data(graphEdges, (edge: EdgeDatum) => edge.id)
      .join("path")
      .attr("class", "d3-edge")
      .attr("stroke", (edge: EdgeDatum) => edge.color)
      .attr("stroke-width", (edge: EdgeDatum) => edge.width)
      .attr("fill", "none")
      .attr("stroke-opacity", (edge: EdgeDatum) => (edge.width > 1.2 ? 0.66 : 0.35))
      .attr("stroke-dasharray", (edge: EdgeDatum) => (edge.width > 1.2 ? "6 7" : ""));

    const nodeSelection = nodeLayer
      .selectAll<SVGCircleElement, GraphNodeDatum>("circle")
      .data(graphNodes, (node: GraphNodeDatum) => node.id)
      .join("circle")
      .attr("class", (node: GraphNodeDatum) =>
        node.node_type === "group" ? "d3-node d3-node-group" : "d3-node d3-node-agent",
      )
      .attr("r", (node: GraphNodeDatum) => Math.max(6, node.size * 0.9))
      .attr("fill", (node: GraphNodeDatum) => (selectedNodeId === node.id ? "#ff8b4a" : node.color))
      .attr("stroke", (node: GraphNodeDatum) => (selectedNodeId === node.id ? "#fff3ea" : "rgba(255, 255, 255, 0.9)"))
      .attr("stroke-width", (node: GraphNodeDatum) => (selectedNodeId === node.id ? 3 : 1.8))
      .attr("opacity", 0)
      .style("cursor", "pointer")
      .on("click", (event: MouseEvent, node: GraphNodeDatum) => {
        event.stopPropagation();
        onSelectNode(node.id);
      })
      .call(
        d3
          .drag<SVGCircleElement, GraphNodeDatum>()
          .on(
            "start",
            (
              event: d3.D3DragEvent<SVGCircleElement, GraphNodeDatum, GraphNodeDatum>,
              node: GraphNodeDatum,
            ) => {
              if (!event.active) simulation.alphaTarget(0.35).restart();
              node.fx = node.x;
              node.fy = node.y;
            },
          )
          .on(
            "drag",
            (
              event: d3.D3DragEvent<SVGCircleElement, GraphNodeDatum, GraphNodeDatum>,
              node: GraphNodeDatum,
            ) => {
              node.fx = event.x;
              node.fy = event.y;
            },
          )
          .on(
            "end",
            (
              event: d3.D3DragEvent<SVGCircleElement, GraphNodeDatum, GraphNodeDatum>,
              node: GraphNodeDatum,
            ) => {
              if (!event.active) simulation.alphaTarget(0);
              node.fx = null;
              node.fy = null;
            },
          ),
      );

    const labelSelection = labelLayer
      .selectAll<SVGTextElement, GraphNodeDatum>("text")
      .data(graphNodes, (node: GraphNodeDatum) => node.id)
      .join("text")
      .attr("class", "d3-node-label")
      .text((node: GraphNodeDatum) => {
        if (node.node_type === "group") return node.label;
        return node.label.length > 28 ? `${node.label.slice(0, 25)}...` : node.label;
      })
      .attr("font-size", (node: GraphNodeDatum) => (node.node_type === "group" ? 12 : 11))
      .attr("font-weight", (node: GraphNodeDatum) => (node.node_type === "group" ? 700 : 500))
      .attr("fill", (node: GraphNodeDatum) => (node.node_type === "group" ? "#202533" : "#6b7284"))
      .style("paint-order", "stroke")
      .style("stroke", "rgba(255,255,255,0.96)")
      .style("stroke-width", "2.4px")
      .style("display", "none")
      .style("pointer-events", "none");

    let zoomK = 1;

    const updateLabels = () => {
      const occupied: Array<{ left: number; top: number; right: number; bottom: number }> = [];
      labelSelection.each(function applyLabelVisibility(node: GraphNodeDatum) {
        const label = d3.select(this);
        const shouldTryRender =
          node.node_type === "group" ||
          (selectedNodeId !== null && node.id === selectedNodeId) ||
          (node.showLabel && zoomK > 1.1);

        if (!shouldTryRender) {
          label.style("display", "none");
          return;
        }

        label.style("display", "block");
        const bbox = (this as SVGTextElement).getBBox();
        const nextBox = {
          left: bbox.x - 3,
          top: bbox.y - 2,
          right: bbox.x + bbox.width + 3,
          bottom: bbox.y + bbox.height + 2,
        };
        const overlaps = occupied.some((existing) => {
          return !(
            nextBox.right < existing.left ||
            nextBox.left > existing.right ||
            nextBox.bottom < existing.top ||
            nextBox.top > existing.bottom
          );
        });

        if (overlaps && node.node_type !== "group" && node.id !== selectedNodeId) {
          label.style("display", "none");
          return;
        }

        occupied.push(nextBox);
      });
    };

    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 5])
      .on("zoom", (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        root.attr("transform", event.transform.toString());
        zoomK = event.transform.k;
        updateLabels();
      });
    svg.call(zoomBehavior);

    function curvedPath(edge: EdgeDatum) {
      const source = edge.source as GraphNodeDatum;
      const target = edge.target as GraphNodeDatum;
      const sx = source.x ?? 0;
      const sy = source.y ?? 0;
      const tx = target.x ?? 0;
      const ty = target.y ?? 0;

      if (edge.isSelfLoop) {
        const loopRadius = Math.max(28, source.size * 1.6);
        const x1 = sx + loopRadius * 0.4;
        const y1 = sy - loopRadius * 0.4;
        const x2 = sx + loopRadius * 0.42;
        const y2 = sy + loopRadius * 0.4;
        return `M${x1},${y1} A${loopRadius},${loopRadius} 0 1,1 ${x2},${y2}`;
      }

      if (edge.pairTotal === 1) {
        return `M${sx},${sy} L${tx},${ty}`;
      }

      const dx = tx - sx;
      const dy = ty - sy;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const normalized = edge.pairTotal > 1 ? edge.pairIndex / (edge.pairTotal - 1) - 0.5 : 0;
      const curveScale = Math.min(1.28, 0.62 + edge.pairTotal * 0.18);
      const curvature = normalized * curveScale;
      const offsetBase = Math.max(24, dist * (0.2 + edge.pairTotal * 0.03));
      const offsetX = (-dy / dist) * curvature * offsetBase;
      const offsetY = (dx / dist) * curvature * offsetBase;
      const cx1 = (sx + tx) / 2 + offsetX;
      const cy1 = (sy + ty) / 2 + offsetY;
      return `M${sx},${sy} Q${cx1},${cy1} ${tx},${ty}`;
    }

    simulation.on("tick", () => {
      linkPath.attr("d", (edge: EdgeDatum) => curvedPath(edge));

      nodeSelection
        .attr("cx", (node: GraphNodeDatum) => node.x ?? 0)
        .attr("cy", (node: GraphNodeDatum) => node.y ?? 0);

      labelSelection
        .attr("x", (node: GraphNodeDatum) => (node.x ?? 0) + Math.max(12, node.size * 0.92))
        .attr("y", (node: GraphNodeDatum) => (node.y ?? 0) + 3);

      updateLabels();
    });

    nodeSelection.transition().duration(420).attr("opacity", 1);

    linkPath
      .attr("stroke-dashoffset", 24)
      .transition()
      .duration(560)
      .attr("stroke-dashoffset", 0);

    svg.on("click", () => {
      onSelectNode(null);
    });

    const fitToGraph = () => {
      if (!graphNodes.length) return;
      const xs = graphNodes.map((node) => node.x ?? 0);
      const ys = graphNodes.map((node) => node.y ?? 0);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const graphWidth = Math.max(1, maxX - minX);
      const graphHeight = Math.max(1, maxY - minY);
      const padding = 110;
      const scale = Math.max(
        0.2,
        Math.min(2.5, Math.min((width - padding) / graphWidth, (height - padding) / graphHeight)),
      );
      const tx = width / 2 - ((minX + maxX) / 2) * scale;
      const ty = height / 2 - ((minY + maxY) / 2) * scale;
      svg
        .transition()
        .duration(280)
        .call(zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
    };

    const fitTimeout = window.setTimeout(() => fitToGraph(), 180);

    return () => {
      window.clearTimeout(fitTimeout);
      previousPositionsRef.current = new Map(
        graphNodes
          .filter((node) => typeof node.x === "number" && typeof node.y === "number")
          .map((node) => [node.id, { x: node.x ?? cx, y: node.y ?? cy }] as const),
      );
      simulation.stop();
      svg.remove();
    };
  }, [nodes, edges, nodesById, onSelectNode, selectedNodeId, resetToken]);

  return <div ref={containerRef} className="sigma-canvas coalition-d3-canvas" />;
}
