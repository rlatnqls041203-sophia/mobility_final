/* global window */
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";

import DeckGL from "@deck.gl/react";
import { Map } from "react-map-gl";
import { TripsLayer } from "@deck.gl/geo-layers";
import { ScatterplotLayer, ArcLayer } from "@deck.gl/layers";
import Slider from "@mui/material/Slider";

import "../css/trip.css";

// ==========================
// MAP 설정
// ==========================
const MAPBOX_TOKEN = `pk.eyJ1Ijoic2hlcnJ5MTAyNCIsImEiOiJjbG00dmtic3YwbGNoM2Zxb3V5NmhxZDZ6In0.ZBrAsHLwNihh7xqTify5hQ`;
const mapStyle = "mapbox://styles/spear5306/ckzcz5m8w002814o2coz02sjc";

const INITIAL_VIEW_STATE = {
  longitude: 127.130622,
  latitude: 37.451748,
  zoom: 13,
  pitch: 30,
  bearing: 0,
};

// ==========================
// 시간 포맷
// ==========================
const addZero = (v) => (v < 10 ? `0${v}` : v);
const getHHMM = (t) => {
  const h = Math.floor(t / 60);
  const m = Math.floor(t % 60);
  return [addZero(h), addZero(m)];
};

// ==========================
// Trip Component
// ==========================
const Trip = ({ routes }) => {

  // 전체 timestamp 중 가장 늦은 값 계산
  const globalMaxTime = useMemo(() => {
    let all = [];
    for (const taxiID in routes) {
      routes[taxiID].forEach(seg => {
        const end = seg.timestamp[seg.timestamp.length - 1];
        all.push(end);
      });
    }
    return Math.max(...all);
  }, [routes]);

  const minTime = 420; // 07:00
  const maxTime = globalMaxTime;

  const [time, setTime] = useState(minTime);

  // ================================
  // 애니메이션 제어 Flags
  // ================================
  const isAutoRef = useRef(true);        // 자동 재생 여부
  const isAnimatingRef = useRef(false);  // animate() 중복 실행 차단

  // ================================
  // 개선된 애니메이션 함수 (방법 2)
  // ================================
  const animate = useCallback(() => {

    if (!isAutoRef.current) {
      isAnimatingRef.current = false;
      return;
    }

    // 이미 실행 중이면 추가 실행 금지 → 속도 폭주 방지 핵심
    if (isAnimatingRef.current) return;
    isAnimatingRef.current = true;

    setTime((prev) => {
      const next = prev + 0.005;

      if (next >= maxTime) {
        isAutoRef.current = false;
        isAnimatingRef.current = false;
        return maxTime;
      }

      return next;
    });

    window.requestAnimationFrame(() => {
      isAnimatingRef.current = false;  // 다음 프레임부터 다시 실행 허용
      animate();
    });

  }, [maxTime]);

  // 초기 애니메이션 시작
  useEffect(() => {
    window.requestAnimationFrame(animate);
  }, [animate]);

  // ================================
  // 슬라이더 변경
  // ================================
  const onSliderChange = (e) => {
    const v = Number(e.target.value);
    setTime(v);

    // 슬라이더를 움직이는 동안 자동재생 OFF
    isAutoRef.current = false;

    // 움직임 멈춘 후 애니메이션 재시작
    setTimeout(() => {
      if (v < maxTime) {
        isAutoRef.current = true;
        window.requestAnimationFrame(animate);
      }
    }, 150);
  };

  // ================================
  // Dynamic Arcs
  // ================================
  const dynamicArcs = useMemo(() => {
    const arcs = [];

    for (const taxiID in routes) {
      const segs = routes[taxiID];

      const activeSeg = segs.find(seg => {
        const ts = seg.timestamp;
        return time >= ts[0] && time <= ts[ts.length - 1];
      });

      if (!activeSeg) continue;
      if (!["pickup", "dropoff"].includes(activeSeg.type)) continue;

      const ts = activeSeg.timestamp;
      const rt = activeSeg.route;

      let idx = ts.findIndex((t, i) => i < ts.length - 1 && t <= time && time <= ts[i + 1]);
      if (idx < 0) idx = 0;

      const maxIdx = Math.min(rt.length, ts.length) - 2;
      idx = Math.max(0, Math.min(idx, maxIdx));

      const a = rt[idx];
      const b = rt[idx + 1];
      const t0 = ts[idx];
      const t1 = ts[idx + 1];
      const r = Math.max(0, Math.min(1, (time - t0) / (t1 - t0)));

      const taxiPos = [
        a[0] + (b[0] - a[0]) * r,
        a[1] + (b[1] - a[1]) * r,
      ];

      arcs.push({
        source: taxiPos,
        target: rt[rt.length - 1],
        color: activeSeg.type === "pickup" ? [255, 0, 0] : [0, 255, 0],
      });
    }
    return arcs;
  }, [routes, time]);

  // ================================
  // Taxi 현재 위치 계산
  // ================================
  const taxiPoints = useMemo(() => {
    const pts = [];

    for (const taxiID in routes) {
      const segs = routes[taxiID];

      const activeSeg = segs.find(seg => {
        const ts = seg.timestamp;
        return time >= ts[0] && time <= ts[ts.length - 1];
      });

      if (activeSeg) {
        const ts = activeSeg.timestamp;
        const rt = activeSeg.route;

        let idx = ts.findIndex((t, i) => i < ts.length - 1 && t <= time && time <= ts[i + 1]);
        if (idx < 0) idx = 0;

        const maxIdx = Math.min(rt.length, ts.length) - 2;
        idx = Math.max(0, Math.min(idx, maxIdx));

        const a = rt[idx];
        const b = rt[idx + 1];
        const t0 = ts[idx];
        const t1 = ts[idx + 1];
        const r = Math.max(0, Math.min(1, (time - t0) / (t1 - t0)));

        pts.push({
          position: [
            a[0] + (b[0] - a[0]) * r,
            a[1] + (b[1] - a[1]) * r
          ],
          color: [0, 122, 255],
        });

        continue;
      }

      // idle state
      const lastSeg = segs[segs.length - 1];
      const lastEnd = lastSeg.timestamp[lastSeg.timestamp.length - 1];

      let idlePos;

      if (time < lastEnd) {
        const pastSeg = [...segs].reverse().find(seg => time >= seg.timestamp[0]);
        idlePos = pastSeg ? pastSeg.route[pastSeg.route.length - 1] : segs[0].route[0];
      } else {
        idlePos = lastSeg.route[lastSeg.route.length - 1];
      }

      pts.push({
        position: idlePos,
        color: [150, 150, 150],
      });
    }

    return pts;
  }, [routes, time]);

  // ================================
  // 전체 경로 Trail
  // ================================
  const taxiTrips = useMemo(() => {
    const arr = [];

    for (const taxiID in routes) {
      for (const seg of routes[taxiID]) {
        arr.push({
          route: seg.route,
          timestamp: seg.timestamp,
          color: [0, 122, 255]
        });
      }
    }
    return arr;
  }, [routes]);

  // ================================
  // DeckGL Layers
  // ================================
  const layers = [

    new TripsLayer({
      id: "taxi-trips",
      data: taxiTrips,
      getPath: d => d.route,
      getTimestamps: d => d.timestamp,
      getColor: d => d.color,
      trailLength: 0.8,
      currentTime: time,
      widthMinPixels: 6,
    }),

    new ArcLayer({
      id: "arcs",
      data: dynamicArcs,
      getSourcePosition: d => d.source,
      getTargetPosition: d => d.target,
      getSourceColor: d => d.color,
      getTargetColor: d => d.color,
      getWidth: 3,
    }),

    new ScatterplotLayer({
      id: "taxi-points",
      data: taxiPoints,
      getPosition: d => d.position,
      getFillColor: d => d.color,
      getRadius: 6,
      radiusUnits: "pixels",
    }),
  ];

  const [hh, mm] = getHHMM(time);

  return (
    <div className="trip-container" style={{ position: "relative" }}>
      <DeckGL initialViewState={INITIAL_VIEW_STATE} controller={true} layers={layers}>
        <Map mapStyle={mapStyle} mapboxAccessToken={MAPBOX_TOKEN} preventStyleDiffing={true} />
      </DeckGL>

      <h1 className="time">TIME : {hh}:{mm}</h1>

      <Slider
        id="slider"
        value={time}
        min={minTime}
        max={maxTime}
        onChange={onSliderChange}
      />
    </div>
  );
};

export default Trip;
