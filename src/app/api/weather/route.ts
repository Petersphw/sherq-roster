import { NextResponse } from "next/server";

// Durban coordinates
const LAT = -29.8587;
const LON = 31.0218;

export async function GET() {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=Africa/Johannesburg&forecast_days=5`,
      { next: { revalidate: 1800 } } // cache 30 min
    );
    if (!res.ok) throw new Error("Weather API failed");
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Weather unavailable" }, { status: 500 });
  }
}
