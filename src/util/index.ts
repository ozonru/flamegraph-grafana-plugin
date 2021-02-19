import { DataFrame } from '@grafana/data';
import { Options } from '../types';

interface Span {
  name: string;
  value: number;
  delta?: number;
  children: Span[];
}

class Path {
  [Symbol.iterator]: () => Iterator<{ service: string; operation: string }>;

  constructor(path: string, pathFromRootToLeaf: boolean) {
    if (!pathFromRootToLeaf) {
      let i = path.length - 1;

      this[Symbol.iterator] = () => ({
        next(): {
          value: { service: string; operation: string };
          done: boolean;
        } {
          if (i === -1) {
            return { done: true, value: { service: '', operation: '' } };
          }

          let nextOperation = path.lastIndexOf('!', i);
          let nextService = nextOperation > -1 ? path.lastIndexOf(';', nextOperation - 1) : -1;
          const value = {
            service: path.slice(nextService + 1, nextOperation),
            operation: path.slice(nextOperation + 1, i),
          };
          i = nextService;
          return {
            done: false,
            value,
          };
        },
      });
    } else {
      let i = 0;

      this[Symbol.iterator] = () => ({
        next(): {
          value: { service: string; operation: string };
          done: boolean;
        } {
          if (i === path.length) {
            return { done: true, value: { service: '', operation: '' } };
          }

          let nextOperation = path.indexOf('!', i);
          let nextService = path.indexOf(';', nextOperation);

          const value = {
            service: path.slice(nextOperation + 1, nextService),
            operation: path.slice(i, nextOperation),
          };
          i = nextService + 1;
          return {
            done: false,
            value,
          };
        },
      });
    }
  }
}

function createNode(name: string): Span {
  return {
    name,
    value: 0.0,
    children: [],
  };
}

export function processSeries(seriesA: DataFrame[], seriesB: DataFrame[], options: Options): Span | undefined {
  const byIdSeriesA = new Map();
  const cache = new Map();
  const ids = new Map();
  let j = 1;

  if (seriesB.length > 0) {
    for (let i = 0; i < seriesA.length; i++) {
      const serie = seriesA[i];
      const valueField = serie.fields.find((f) => f.name === 'Value');

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
    const valueField = serie.fields.find((f) => f.name === 'Value');

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

    for (const { service, operation } of new Path(valueField.labels.path, options.pathOrder)) {
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
