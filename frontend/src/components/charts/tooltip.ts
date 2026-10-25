/** The subset of Recharts' tooltip props our content functions use. */
export interface TooltipProps<Row> {
  active?: boolean
  payload?: ReadonlyArray<{ payload?: Row }>
}

/** The data row under the pointer, or undefined when the tooltip is inactive. */
export const rowOf = <Row>(p: TooltipProps<Row>): Row | undefined =>
  p.active ? p.payload?.[0]?.payload : undefined
