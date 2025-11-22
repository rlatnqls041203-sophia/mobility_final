// ================================================================
// App.js — 파일 경로를 직접 지정할 수 있도록 개선된 버전
// ================================================================

import "mapbox-gl/dist/mapbox-gl.css";
import React, { useState, useEffect, useCallback } from "react";

import Splash from "./components/Splash";
import Trip from "./components/Trip";

import "./css/app.css";


// ---------------------------------------------------------------
// 🔥 (1) 네가 직접 바꾸면 되는 부분
// ---------------------------------------------------------------
const ROUTE_FILE = "routes_complete_100";     // ← 여기만 수정하면 됨
const TAXIS_FILE = "taxis_100";              // ← 여기 수정
const PASSENGERS_FILE = "passengers";          // (보통 고정)

// ---------------------------------------------------------------
// fetchData: public/data/{FILE_NAME}.json
// ---------------------------------------------------------------
const fetchData = (FILE_NAME) => {
  return fetch(`${process.env.PUBLIC_URL}/data/${FILE_NAME}.json`)
    .then(response => response.json());
};



// ---------------------------------------------------------------
// App Component
// ---------------------------------------------------------------
const App = () => {

  const [isLoaded, setIsLoaded] = useState(false);

  const [routes, setRoutes] = useState(null);
  const [passengers, setPassengers] = useState([]);
  const [taxis, setTaxis] = useState([]);


  // -------------------------------------------------------------
  // loadAllData: 설정된 파일 이름 기준 데이터 로드
  // -------------------------------------------------------------
  const loadAllData = useCallback(async () => {

    try {
      // 🔥 1) route_complete 파일
      const ROUTES = await fetchData(ROUTE_FILE);
      setRoutes(ROUTES);

      // 🔥 2) passengers 파일
      const PASS = await fetchData(PASSENGERS_FILE).catch(() => []);
      setPassengers(PASS);

      // 🔥 3) taxis 파일
      const T = await fetchData(TAXIS_FILE).catch(() => []);
      setTaxis(T);

      setIsLoaded(true);

    } catch (error) {
      console.error("❌ 데이터 로딩 실패:", error);
    }

  }, []);


  useEffect(() => {
    loadAllData();
  }, [loadAllData]);


  return (
    <div className="container">

      {!isLoaded && <Splash />}

      {isLoaded && routes && (
        <Trip
          routes={routes}
          passengers={passengers}
          taxis={taxis}
        />
      )}

    </div>
  );
};

export default App;
