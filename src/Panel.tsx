import React from 'react';
import { flamegraph } from 'd3-flame-graph';
import * as d3 from 'd3';
import { LoadingState, PanelProps, toFixed } from '@grafana/data';
import { Options } from 'types';
import { processSeries } from './util';

import 'd3-flame-graph/dist/d3-flamegraph.css';

interface Props extends PanelProps<Options> {}

const MS_IN_SECOND = 1000;

function nsToString(v: number): string {
  if (v >= MS_IN_SECOND * MS_IN_SECOND) {
    return toFixed(v / (MS_IN_SECOND * MS_IN_SECOND), 2) + 's';
  } else if (v >= MS_IN_SECOND) {
    return toFixed(v / MS_IN_SECOND, 2) + 'ms';
  }
  return toFixed(v, 2) + 'ns';
}

export class FlameGraphPanel extends React.Component<Props> {
  divRef: React.RefObject<HTMLDivElement>;

  constructor(props: Props) {
    super(props);
    this.divRef = React.createRef<HTMLDivElement>();
  }

  render() {
    const { width, height } = this.props;
    return <div key={width * 1e3 + height} ref={this.divRef} />;
  }

  renderFlamegraph() {
    if (!this.divRef.current) {
      return;
    }

    const { data, width, height } = this.props;

    if (data.state !== LoadingState.Done) {
      return;
    }

    const seriesA = [];
    const seriesB = [];
    const traceCount = [];
    const size = data.series.length;

    for (let i = 0; i < size; i++) {
      const serie = data.series[i];

      if (serie.refId === 'A') {
        seriesA.push(serie);
      } else if (serie.refId === 'count') {
        traceCount.push(serie);
      } else {
        seriesB.push(serie);
      }
    }

    if (seriesA.length === 0) {
      this.divRef.current.innerText = 'No series';
      return;
    }

    const fg = flamegraph()
      .width(width)
      .height(height)
      .selfValue(true)
      .differential(seriesB.length > 0)
      .label(
        (node) =>
          `${node.data.name}:
mean: ${nsToString(node.data.sum / node.data.cnt)}
perc: ${toFixed(node.data.perc, 1)}%
count: ${toFixed(node.data.cnt, 0)}
sum: ${nsToString(node.data.sum)} ${
            node.data.delta
              ? `
self: ${nsToString(node.data.delta)}`
              : ''
          }`
      );
    d3.select(this.divRef.current).datum(processSeries(seriesA, seriesB, traceCount, this.props.options)).call(fg);
  }

  shouldComponentUpdate(nextProps: Readonly<Props>, nextState: Readonly<{}>, nextContext: any): boolean {
    return (
      nextProps.data !== this.props.data ||
      nextProps.width !== this.props.width ||
      nextProps.height !== this.props.height
    );
  }

  componentDidMount(): void {
    this.renderFlamegraph();
  }

  componentDidUpdate(): void {
    this.renderFlamegraph();
  }
}
