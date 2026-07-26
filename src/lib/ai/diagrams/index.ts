export {
  diagramSpecSchema,
  figureInputSchema,
  defaultIncludeFigures,
  VISUAL_TOPICS,
  type DiagramSpec,
  type FigureInput,
  type ProblemFigure,
} from "@/lib/ai/diagrams/types";
export {
  renderDiagram,
  materializeFigures,
  getFigureFromPayload,
  figureUrl,
  parseFigureInputs,
} from "@/lib/ai/diagrams/render";
