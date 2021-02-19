import { PanelPlugin } from '@grafana/data';
import { Options } from './types';
import { FlameGraphPanel } from './Panel';

export const plugin = new PanelPlugin<Options>(FlameGraphPanel).setPanelOptions((builder) => {
  builder.addBooleanSwitch({
    name: 'Path from root⇾leaf',
    path: 'pathOrder',
    defaultValue: true,
  });
});
