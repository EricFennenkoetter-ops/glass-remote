import { Icon } from './Icon';
import { useCrossfade } from './useCrossfade';

type CoverProps = { url: string | null; alt: string };

export function Cover({ url, alt }: CoverProps) {
  const { layers, markReady } = useCrossfade(url, url);

  return (
    <div className="cover">
      <div className="cover__placeholder">
        <Icon name="music" size={56} />
      </div>
      {layers.map((layer) => (
        <img
          key={layer.id}
          className={`cover__image${layer.ready ? ' is-ready' : ''}`}
          src={layer.value}
          alt={layer === layers.at(-1) ? alt : ''}
          draggable={false}
          onLoad={() => markReady(layer.id)}
          onError={() => markReady(layer.id)}
        />
      ))}
      <div className="cover__edge" aria-hidden="true" />
    </div>
  );
}
