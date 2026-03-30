"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FactionUiPayload, FactionView } from "@/interfaces/faction";
import { $img } from "@/utils";

type TerritoryAnchor = {
  faction: FactionView;
  x: number;
  y: number;
  weight: number;
};

function hashString(input: string) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRandom(seed: string) {
  let state = hashString(seed) || 1;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function fract(value: number) {
  return value - Math.floor(value);
}

function lerp(left: number, right: number, factor: number) {
  return left + (right - left) * factor;
}

function smoothstep(value: number) {
  return value * value * (3 - 2 * value);
}

function noise2D(seed: number, x: number, y: number) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = x0 + 1;
  const y1 = y0 + 1;

  const fx = smoothstep(x - x0);
  const fy = smoothstep(y - y0);

  const randomAt = (px: number, py: number) =>
    fract(Math.sin(px * 127.1 + py * 311.7 + seed * 0.173) * 43758.5453123);

  const top = lerp(randomAt(x0, y0), randomAt(x1, y0), fx);
  const bottom = lerp(randomAt(x0, y1), randomAt(x1, y1), fx);
  return lerp(top, bottom, fy);
}

function layeredNoise(seed: number, x: number, y: number) {
  return (
    noise2D(seed, x * 0.9, y * 0.9) * 0.58 +
    noise2D(seed + 17, x * 1.8, y * 1.8) * 0.29 +
    noise2D(seed + 41, x * 3.4, y * 3.4) * 0.13
  );
}

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  const value = normalized.length === 3
    ? normalized
        .split("")
        .map((item) => `${item}${item}`)
        .join("")
    : normalized;

  const numeric = Number.parseInt(value, 16);
  return {
    r: (numeric >> 16) & 255,
    g: (numeric >> 8) & 255,
    b: numeric & 255,
  };
}

function uniqueEdges(data: FactionUiPayload) {
  const seen = new Set<string>();
  const edges: Array<[number, number]> = [];

  for (const node of data.mapNodes) {
    for (const neighborId of node.neighborNodeIds) {
      const key = [node.id, neighborId].sort((a, b) => a - b).join(":");
      if (!seen.has(key) && data.mapNodes.find((item) => item.id === neighborId)) {
        seen.add(key);
        edges.push([node.id, neighborId]);
      }
    }
  }

  return edges;
}

function shortNodeName(name: string) {
  return name.length <= 2 ? name : name.slice(0, 2);
}

function buildTerritoryAnchors(data: FactionUiPayload) {
  const anchors: TerritoryAnchor[] = [];
  const factionsById = new Map(data.factions.map((item) => [item.id, item]));

  for (const node of data.mapNodes) {
    if (!node.ownerFactionId) {
      continue;
    }
    const faction = factionsById.get(node.ownerFactionId);
    if (!faction) {
      continue;
    }

    anchors.push({
      faction,
      x: node.positionX / 100,
      y: node.positionY / 100,
      weight: node.isCapital ? 1.45 : 1,
    });
  }

  return anchors;
}

type FactionMapCanvasProps = {
  data: FactionUiPayload;
  mode?: "preview" | "immersive";
  selectedNodeId?: number | null;
  onSelectNode?: (nodeId: number) => void;
};

export function FactionMapCanvas({
  data,
  mode = "immersive",
  selectedNodeId: controlledSelectedNodeId,
  onSelectNode,
}: FactionMapCanvasProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const initialNodeId = data.playerState.currentNodeId || data.mapNodes[0]?.id || null;
  const [internalSelectedNodeId, setInternalSelectedNodeId] = useState<number | null>(controlledSelectedNodeId ?? initialNodeId);
  const isPreview = mode === "preview";
  const edges = useMemo(() => uniqueEdges(data), [data]);
  const anchors = useMemo(() => buildTerritoryAnchors(data), [data]);
  const nodeMap = useMemo(() => new Map(data.mapNodes.map((node) => [node.id, node])), [data.mapNodes]);
  const selectedNodeId = controlledSelectedNodeId === undefined ? internalSelectedNodeId : controlledSelectedNodeId;
  const selectedNode = selectedNodeId ? nodeMap.get(selectedNodeId) : data.mapNodes[0];

  useEffect(() => {
    if (controlledSelectedNodeId === undefined) {
      setInternalSelectedNodeId(initialNodeId);
    }
  }, [controlledSelectedNodeId, initialNodeId]);

  const handleSelectNode = (nodeId: number) => {
    if (controlledSelectedNodeId === undefined) {
      setInternalSelectedNodeId(nodeId);
    }
    onSelectNode?.(nodeId);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const seedBase = hashString(data.world.seed);

    const draw = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      const ratio = window.devicePixelRatio || 1;

      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);

      const paper = context.createLinearGradient(0, 0, width, height);
      paper.addColorStop(0, "rgba(246, 238, 218, 0.96)");
      paper.addColorStop(0.55, "rgba(231, 218, 188, 0.96)");
      paper.addColorStop(1, "rgba(215, 198, 165, 0.98)");
      context.fillStyle = paper;
      context.fillRect(0, 0, width, height);

      const lowWidth = Math.max(220, Math.floor(width / 4));
      const lowHeight = Math.max(110, Math.floor(height / 4));
      const offscreen = document.createElement("canvas");
      offscreen.width = lowWidth;
      offscreen.height = lowHeight;
      const offscreenContext = offscreen.getContext("2d");
      if (!offscreenContext) {
        return;
      }

      const imageData = offscreenContext.createImageData(lowWidth, lowHeight);
      const ownerGrid = new Uint16Array(lowWidth * lowHeight);
      const landGrid = new Float32Array(lowWidth * lowHeight);

      for (let y = 0; y < lowHeight; y += 1) {
        for (let x = 0; x < lowWidth; x += 1) {
          const index = y * lowWidth + x;
          const dataIndex = index * 4;
          const nx = x / lowWidth;
          const ny = y / lowHeight;

          const mapX = nx * 2 - 1;
          const mapY = ny * 2 - 1;
          const landBase = 1 - (mapX * mapX * 0.82 + mapY * mapY * 2.05);
          const landNoise = layeredNoise(seedBase, x / 22, y / 22) - 0.5;
          const coastlineNoise = layeredNoise(seedBase + 77, x / 10, y / 10) - 0.5;
          const land = landBase + landNoise * 0.52 + coastlineNoise * 0.12;
          landGrid[index] = land;

          if (land < -0.08) {
            imageData.data[dataIndex] = 211;
            imageData.data[dataIndex + 1] = 221;
            imageData.data[dataIndex + 2] = 222;
            imageData.data[dataIndex + 3] = 62;
            continue;
          }

          let bestAnchor: TerritoryAnchor | undefined;
          let bestScore = -Infinity;
          let secondScore = -Infinity;

          for (const anchor of anchors) {
            const dx = nx - anchor.x;
            const dy = ny - anchor.y;
            const distance = dx * dx * 1.08 + dy * dy * 0.92;
            const score = anchor.weight * (0.95 / (distance + 0.012));
            if (score > bestScore) {
              secondScore = bestScore;
              bestScore = score;
              bestAnchor = anchor;
            } else if (score > secondScore) {
              secondScore = score;
            }
          }

          if (!bestAnchor) {
            imageData.data[dataIndex] = 228;
            imageData.data[dataIndex + 1] = 216;
            imageData.data[dataIndex + 2] = 194;
            imageData.data[dataIndex + 3] = 90;
            continue;
          }

          ownerGrid[index] = bestAnchor.faction.id;
          const rgb = hexToRgb(bestAnchor.faction.palette.primary);
          const closeness = Math.max(0.22, Math.min(1, (bestScore - secondScore) / (bestScore + 0.0001) + 0.42));
          const tint = Math.max(0.58, Math.min(0.9, 0.68 + (layeredNoise(seedBase + bestAnchor.faction.id * 19, x / 14, y / 14) - 0.5) * 0.16));
          const paperMix = 1 - tint;

          imageData.data[dataIndex] = Math.round(241 * paperMix + rgb.r * tint);
          imageData.data[dataIndex + 1] = Math.round(233 * paperMix + rgb.g * tint);
          imageData.data[dataIndex + 2] = Math.round(214 * paperMix + rgb.b * tint);
          imageData.data[dataIndex + 3] = Math.round(140 + closeness * 52 + Math.max(0, land) * 18);
        }
      }

      offscreenContext.putImageData(imageData, 0, 0);
      context.save();
      context.imageSmoothingEnabled = true;
      context.globalAlpha = 0.95;
      context.drawImage(offscreen, 0, 0, width, height);
      context.restore();

      context.save();
      context.strokeStyle = "rgba(103, 78, 47, 0.14)";
      context.lineWidth = 1;
      for (let y = 0; y < lowHeight - 1; y += 1) {
        for (let x = 0; x < lowWidth - 1; x += 1) {
          const index = y * lowWidth + x;
          if (landGrid[index] < -0.08) {
            continue;
          }
          const current = ownerGrid[index];
          const right = ownerGrid[index + 1];
          const bottom = ownerGrid[index + lowWidth];
          const scaleX = width / lowWidth;
          const scaleY = height / lowHeight;
          const px = x * scaleX;
          const py = y * scaleY;

          if (current !== right) {
            context.beginPath();
            context.moveTo(px + scaleX, py);
            context.lineTo(px + scaleX, py + scaleY);
            context.stroke();
          }

          if (current !== bottom) {
            context.beginPath();
            context.moveTo(px, py + scaleY);
            context.lineTo(px + scaleX, py + scaleY);
            context.stroke();
          }
        }
      }
      context.restore();

      const terrainRandom = createSeededRandom(`${data.world.seed}:terrain`);
      context.save();
      context.strokeStyle = "rgba(122, 100, 70, 0.18)";
      context.lineWidth = 1.4;
      for (let ridge = 0; ridge < 7; ridge += 1) {
        const startX = (0.08 + terrainRandom() * 0.8) * width;
        const startY = (0.16 + terrainRandom() * 0.54) * height;
        const segments = 4 + Math.floor(terrainRandom() * 3);
        for (let index = 0; index < segments; index += 1) {
          const x = startX + index * (18 + terrainRandom() * 16);
          const y = startY + Math.sin(index * 0.9 + terrainRandom()) * (10 + terrainRandom() * 12);
          context.beginPath();
          context.moveTo(x - 10, y + 8);
          context.lineTo(x, y - 10);
          context.lineTo(x + 10, y + 8);
          context.stroke();
        }
      }

      context.strokeStyle = "rgba(130, 168, 186, 0.22)";
      context.lineWidth = 2.6;
      for (let river = 0; river < 2; river += 1) {
        const startY = (0.16 + terrainRandom() * 0.52) * height;
        const endY = (0.2 + terrainRandom() * 0.54) * height;
        context.beginPath();
        context.moveTo(width * 0.04, startY);
        context.bezierCurveTo(
          width * (0.22 + terrainRandom() * 0.08),
          startY + (terrainRandom() - 0.5) * 120,
          width * (0.56 + terrainRandom() * 0.1),
          endY + (terrainRandom() - 0.5) * 120,
          width * 0.96,
          endY,
        );
        context.stroke();
      }
      context.restore();

      context.save();
      context.strokeStyle = "rgba(111, 87, 57, 0.16)";
      context.lineWidth = 4;
      context.lineCap = "round";
      context.lineJoin = "round";
      for (const [fromId, toId] of edges) {
        const from = nodeMap.get(fromId);
        const to = nodeMap.get(toId);
        if (!from || !to) {
          continue;
        }

        const startX = (from.positionX / 100) * width;
        const startY = (from.positionY / 100) * height;
        const endX = (to.positionX / 100) * width;
        const endY = (to.positionY / 100) * height;
        const curveOffset = Math.abs(endX - startX) * 0.05;

        context.beginPath();
        context.moveTo(startX, startY);
        context.bezierCurveTo(
          startX + curveOffset,
          startY - 10,
          endX - curveOffset,
          endY + 10,
          endX,
          endY,
        );
        context.stroke();
      }
      context.restore();
    };

    const observer = new ResizeObserver(draw);
    observer.observe(container);
    draw();

    return () => {
      observer.disconnect();
    };
  }, [anchors, data.world.seed, edges, nodeMap]);

  useEffect(() => {
    const section = sectionRef.current;
    const scroller = section?.parentElement;
    if (isPreview || !section || !scroller || !selectedNode) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const sectionWidth = section.getBoundingClientRect().width;
      const targetCenter = (selectedNode.positionX / 100) * sectionWidth;
      const maxScrollLeft = Math.max(0, sectionWidth - scroller.clientWidth);
      const nextLeft = Math.min(
        maxScrollLeft,
        Math.max(0, targetCenter - scroller.clientWidth / 2),
      );
      scroller.scrollTo({ left: nextLeft, behavior: "smooth" });
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [isPreview, selectedNode]);

  return (
    <section ref={sectionRef} className={isPreview ? "w-full" : "min-w-[1040px]"}>
      <div
        className="relative overflow-hidden rounded-[30px] border border-[rgba(135,102,56,0.32)] bg-[rgba(244,233,212,0.92)] shadow-[0_22px_54px_rgba(54,35,16,0.16)]"
        style={{ background: `linear-gradient(160deg, rgba(245,236,217,0.94), rgba(219,202,173,0.94)), url(${$img("bg")}) center/cover no-repeat` }}
      >
        <div className="absolute inset-0 opacity-[0.08]" style={{ background: `url(${$img("mask-repect")}) center/38% repeat` }} />
        <div
          ref={containerRef}
          className={`relative overflow-hidden rounded-[28px] ${isPreview ? "h-[220px] sm:h-[250px]" : "h-[300px] lg:h-[320px]"}`}
        >
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

          {data.mapNodes.map((node) => {
            const selected = node.id === selectedNodeId;
            return (
              <div
                key={node.id}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${node.positionX}%`, top: `${node.positionY}%` }}
              >
                <button
                  type="button"
                  onClick={() => handleSelectNode(node.id)}
                  className={`relative flex items-center justify-center rounded-full border font-semibold tracking-[0.04em] text-[#fff7e8] shadow-[0_10px_22px_rgba(41,27,10,0.18)] transition ${
                    isPreview ? "h-[18px] min-w-[18px] px-1 text-[7px]" : "h-[24px] min-w-[24px] px-1.5 text-[7px] sm:h-[26px] sm:min-w-[26px] sm:px-2 sm:text-[8px]"
                  } ${
                    selected ? "scale-110 border-[rgba(255,241,212,0.92)] shadow-[0_0_0_3px_rgba(255,244,220,0.34)]" : "border-[rgba(255,255,255,0.4)]"
                  }`}
                  style={{
                    background: `radial-gradient(circle at 28% 28%, rgba(255,255,255,0.34), ${node.ownerFactionPalette?.primary || "#8e6a38"} 46%, rgba(43,30,18,0.92) 100%)`,
                  }}
                >
                  {shortNodeName(node.name)}
                  {node.isCapital ? (
                    <div className={`absolute left-1/2 -translate-x-1/2 rounded-full border border-[rgba(255,255,255,0.76)] bg-[#f0d39c] ${isPreview ? "-top-1 h-[7px] w-[7px]" : "-top-1.5 h-[9px] w-[9px]"}`} />
                  ) : null}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
