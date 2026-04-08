import { describe, it, expect } from 'vitest';
import { calculateDistance } from './locationUtils';

describe('locationUtils', () => {
  it('should calculate zero distance for the same point', () => {
    const lat = -23.5505;
    const lon = -46.6333;
    expect(calculateDistance(lat, lon, lat, lon)).toBe(0);
  });

  it('should calculate correct distance for known points (São Paulo to Rio)', () => {
    // Approx coordinates for São Paulo (Praça da Sé) and Rio de Janeiro (Cristo Redentor)
    const sp = { lat: -23.5505, lon: -46.6333 };
    const rj = { lat: -22.9519, lon: -43.2105 };
    
    // Distance should be approximately 357km
    const dist = calculateDistance(sp.lat, sp.lon, rj.lat, rj.lon);
    expect(dist / 1000).toBeGreaterThan(350);
    expect(dist / 1000).toBeLessThan(370);
  });

  it('should detect proximity correctly (within 500m radius)', () => {
    const box = { lat: -23.5505, lon: -46.6333 };
    
    // Point approx 100m away
    const nearby = { lat: -23.5510, lon: -46.6338 }; 
    const distNear = calculateDistance(box.lat, box.lon, nearby.lat, nearby.lon);
    
    // Point approx 2km away
    const far = { lat: -23.5600, lon: -46.6500 };
    const distFar = calculateDistance(box.lat, box.lon, far.lat, far.lon);
    
    expect(distNear).toBeLessThan(500);
    expect(distFar).toBeGreaterThan(500);
  });
});
