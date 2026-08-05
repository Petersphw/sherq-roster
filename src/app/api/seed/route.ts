import { NextResponse } from "next/server";
import { pool } from "@/db";
import { ensureTables } from "@/db/migrate";

export async function POST() {
  try {
    await ensureTables();

    // Check if already seeded using raw SQL (most reliable)
    const check = await pool.query("SELECT count(*)::int as c FROM members");
    if (check.rows[0].c > 0) {
      return NextResponse.json({ message: "Already seeded" });
    }

    // Insert members using raw SQL for maximum reliability
    await pool.query(`
      INSERT INTO members (name, role, department, email, sort_order, is_admin) VALUES
      ('Don Khumalo', 'HOD', 'SHERQ', 'Donk@sas.co.za', 0, true),
      ('Peter S. Mavundla', 'Presenter', 'SHERQ', 'PeterSM@sas.co.za', 1, true),
      ('Andile S. Zondi', 'Presenter', 'SHERQ', 'Andilesz@sas.co.za', 2, false),
      ('Thokozani Jali', 'Presenter', 'SHERQ', 'SASNurses@sas.co.za', 3, false),
      ('Denis Alexander', 'Presenter', 'SHERQ', 'DenisA@sas.co.za', 4, false),
      ('Gary Phillips', 'Presenter', 'SHERQ', 'garyp@sas.co.za', 5, false),
      ('Precious Nkabinde', 'Presenter', 'SHERQ', 'PreciousN@sas.co.za', 6, false),
      ('Fazel Groenewald', 'Presenter', 'SHERQ', 'FazelG@sas.co.za', 7, false),
      ('Nokuthula Dubazane', 'Presenter', 'SHERQ', 'nokuthulad@sas.co.za', 8, false),
      ('Mosco Baloyi', 'Presenter', 'SHERQ', 'MoscoB@sas.co.za', 9, false),
      ('Anele Luthuli', 'Presenter', 'SHERQ', 'reception@sas.co.za', 10, false),
      ('Nandi Langa', 'Presenter', 'SHERQ', 'NandiL@sas.co.za', 11, false)
    `);

    // Insert topics
    await pool.query(`
      INSERT INTO topics (category, title, description) VALUES
      ('Safety', 'PPE Compliance & Inspection', 'Proper use and inspection of Personal Protective Equipment'),
      ('Safety', 'Hazard Identification & Risk Assessment', 'Identifying workplace hazards and assessing risks (HIRA)'),
      ('Safety', 'Fire Safety & Emergency Evacuation', 'Fire prevention and emergency evacuation procedures'),
      ('Safety', 'Working at Heights', 'Safety procedures for working at elevated positions on vessels'),
      ('Safety', 'Lockout/Tagout (LOTO) Procedures', 'Energy isolation procedures for maintenance work'),
      ('Safety', 'Slip, Trip & Fall Prevention', 'Preventing common workplace injuries in the shipyard'),
      ('Safety', 'Machine Guarding & Workshop Safety', 'Proper use and maintenance of machine guards'),
      ('Safety', 'Confined Space Entry', 'Safety procedures for entering confined spaces on ships'),
      ('Safety', 'Hot Work Safety', 'Welding, cutting and grinding safety procedures'),
      ('Safety', 'Crane & Lifting Operations', 'Safe lifting practices and crane operation protocols'),
      ('Safety', 'Scaffolding Safety', 'Erection, inspection and use of scaffolding'),
      ('Safety', 'Electrical Safety', 'Working safely with electrical systems and equipment'),
      ('Health', 'Heat Stress Awareness', 'Recognizing and preventing heat-related illness'),
      ('Health', 'Noise Exposure & Hearing Conservation', 'Protecting hearing in noisy shipyard environments'),
      ('Health', 'Manual Handling & Ergonomics', 'Proper lifting techniques and workstation setup'),
      ('Health', 'Dust & Respiratory Protection', 'Preventing respiratory issues from dust and fume exposure'),
      ('Health', 'Mental Health & Wellbeing', 'Workplace mental health awareness'),
      ('Health', 'First Aid Awareness', 'Basic first aid procedures and emergency response'),
      ('Health', 'Substance Abuse Awareness', 'Understanding the dangers of substance abuse at work'),
      ('Environment', 'Waste Management & Segregation', 'Proper waste handling and recycling procedures'),
      ('Environment', 'Spill Response & Containment', 'How to respond to chemical or oil spills'),
      ('Environment', 'Water Conservation', 'Reducing water usage in the shipyard'),
      ('Environment', 'Energy Conservation', 'Reducing energy consumption and carbon footprint'),
      ('Environment', 'Marine Pollution Prevention', 'Preventing contamination of harbour waters'),
      ('Risk', 'Incident Reporting & Investigation', 'How to report and investigate workplace incidents'),
      ('Risk', 'Near Miss Reporting', 'Importance of reporting near misses'),
      ('Risk', 'Job Safety Analysis (JSA)', 'Conducting proper job safety analysis'),
      ('Risk', 'Permit to Work System', 'Understanding the permit to work process at SAS'),
      ('Risk', 'Emergency Preparedness', 'Being prepared for emergencies in the shipyard'),
      ('Quality', 'Document Control', 'Proper handling and control of quality documents'),
      ('Quality', 'Non-Conformance Reporting (NCR)', 'Identifying and reporting quality non-conformances'),
      ('Quality', 'Continuous Improvement (Kaizen)', 'Embracing continuous improvement principles'),
      ('Quality', 'ISO 9001:2015 Awareness', 'Understanding our quality management system'),
      ('Quality', 'Customer Focus & Satisfaction', 'Meeting and exceeding customer expectations'),
      ('Quality', 'Housekeeping & 5S', 'Maintaining a clean and organized workplace'),
      ('General', 'Team Communication', 'Effective communication within the team'),
      ('General', 'Time Management', 'Managing time effectively at work'),
      ('General', 'Workplace Ethics', 'Professional conduct and ethics')
    `);

    return NextResponse.json({ message: "OK" }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Seed error:", message);
    return NextResponse.json({ error: `Seed failed: ${message}` }, { status: 500 });
  }
}
