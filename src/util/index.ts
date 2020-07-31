import { DataFrame } from '@grafana/data';

interface Span {
  name: string;
  value: number;
  delta?: number;
  children: Span[];
}

class Path {
  [Symbol.iterator]: () => Iterator<{ service: string; operation: string }>;

  constructor(path: string) {
    let i = path.length - 1;

    this[Symbol.iterator] = () => ({
      next(): {
        value: { service: string; operation: string };
        done: boolean;
      } {
        let nextOperation = path.lastIndexOf('!', i);
        let nextService = nextOperation > -1 ? path.lastIndexOf(';', nextOperation - 1) : -1;
        const done = nextService === -1;
        const value = {
          service: path.slice(nextService + 1, nextOperation),
          operation: path.slice(nextOperation + 1, i),
        };
        i = nextService;
        return {
          done,
          value,
        };
      },
    });
  }
}

function createNode(name: string): Span {
  return {
    name,
    value: 0.0,
    children: [],
  };
}

export function processSeries(seriesA: DataFrame[], seriesB: DataFrame[]): Span | undefined {
  const byIdSeriesA = new Map();
  const cache = new Map();
  const ids = new Map();
  let j = 1;

  if (seriesB.length > 0) {
    for (let i = 0; i < seriesA.length; i++) {
      const serie = seriesA[i];
      const valueField = serie.fields.find(f => f.name === 'Value');

      if (!valueField) {
        continue;
      }
      if (!valueField.labels || !('path' in valueField.labels)) {
        continue;
      }

      const value = valueField.values.get(0);

      if (!value) {
        continue;
      }

      byIdSeriesA.set(valueField.labels.path, value);
    }
  } else {
    seriesB = seriesA;
  }

  for (let i = 0; i < seriesB.length; i++) {
    const serie = seriesB[i];
    const valueField = serie.fields.find(f => f.name === 'Value');

    if (!valueField) {
      continue;
    }
    if (!valueField.labels || !('path' in valueField.labels)) {
      continue;
    }

    const value = valueField.values.get(0);

    if (!value) {
      continue;
    }

    let path = '';
    let last: Span | undefined;
    const prev = byIdSeriesA.get(valueField.labels.path);
    const delta = prev ? value - prev : value;

    for (const { service, operation } of new Path(valueField.labels.path)) {
      let name = `${service} ${operation}`;
      let id = ids.get(name);

      if (!id) {
        id = j++;
        ids.set(name, id);
      }

      path += `${id};`;
      let node = cache.get(path);

      if (!node) {
        node = createNode(name);
        cache.set(path, node);
      }

      if (last) {
        const has = last.children.indexOf(node);

        if (has === -1) {
          last.children.push(node);
        }
      }

      last = node;
    }

    if (last) {
      last.value = value;
      last.delta = delta;
    }
  }

  return cache.get('1;');
}
