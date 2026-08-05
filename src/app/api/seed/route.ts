import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/migrate";
import { members, topics } from "@/db/schema";

export async function POST() {
  try {
    await ensureTables();

    const existing = await db.select().from(members);
    if (existing.length > 0) {
      return NextResponse.json({ message: "Data already seeded" });
    }

    await db.insert(members).values([
      { name: "Don Khumalo", role: "HOD", department: "SHERQ", email: "Donk@sas.co.za", sortOrder: 0 },
      { name: "Peter S. Mavundla", role: "Presenter", department: "SHERQ", email: "PeterSM@sas.co.za", sortOrder: 1 },
      { name: "Andile S. Zondi", role: "Presenter", department: "SHERQ", email: "Andilesz@sas.co.za", sortOrder: 2 },
      { name: "Thokozani Jali", role: "Presenter", department: "SHERQ", email: "SASNurses@sas.co.za", sortOrder: 3 },
      { name: "Denis Alexander", role: "Presenter", department: "SHERQ", email: "DenisA@sas.co.za", sortOrder: 4 },
      { name: "Gary Phillips", role: "Presenter", department: "SHERQ", email: "garyp@sas.co.za", sortOrder: 5 },
      { name: "Precious Nkabinde", role: "Presenter", department: "SHERQ", email: "PreciousN@sas.co.za", sortOrder: 6 },
      { name: "Fazel Groenewald", role: "Presenter", department: "SHERQ", email: "FazelG@sas.co.za", sortOrder: 7 },
      { name: "Nokuthula Dubazane", role: "Presenter", department: "SHERQ", email: "nokuthulad@sas.co.za", sortOrder: 8 },
      { name: "Mosco Baloyi", role: "Presenter", department: "SHERQ", email: "MoscoB@sas.co.za", sortOrder: 9 },
      { name: "Anele Luthuli", role: "Presenter", department: "SHERQ", email: "reception@sas.co.za", sortOrder: 10 },
      { name: "Nandi Langa", role: "Presenter", department: "SHERQ", email: "NandiL@sas.co.za", sortOrder: 11 },
    ]);

    await db.insert(topics).values([
      { category: "Safety", title: "PPE Compliance & Inspection", description: "Proper use and inspection of Personal Protective Equipment" },
      { category: "Safety", title: "Hazard Identification & Risk Assessment", description: "Identifying workplace hazards and assessing risks (HIRA)" },
      { category: "Safety", title: "Fire Safety & Emergency Evacuation", description: "Fire prevention and emergency evacuation procedures" },
      { category: "Safety", title: "Working at Heights", description: "Safety procedures for working at elevated positions on vessels" },
      { category: "Safety", title: "Lockout/Tagout (LOTO) Procedures", description: "Energy isolation procedures for maintenance work" },
      { category: "Safety", title: "Slip, Trip & Fall Prevention", description: "Preventing common workplace injuries in the shipyard" },
      { category: "Safety", title: "Machine Guarding & Workshop Safety", description: "Proper use and maintenance of machine guards" },
      { category: "Safety", title: "Confined Space Entry", description: "Safety procedures for entering confined spaces on ships" },
      { category: "Safety", title: "Hot Work Safety", description: "Welding, cutting and grinding safety procedures" },
      { category: "Safety", title: "Crane & Lifting Operations", description: "Safe lifting practices and crane operation protocols" },
      { category: "Safety", title: "Scaffolding Safety", description: "Erection, inspection and use of scaffolding" },
      { category: "Safety", title: "Electrical Safety", description: "Working safely with electrical systems and equipment" },
      { category: "Health", title: "Heat Stress Awareness", description: "Recognizing and preventing heat-related illness" },
      { category: "Health", title: "Noise Exposure & Hearing Conservation", description: "Protecting hearing in noisy shipyard environments" },
      { category: "Health", title: "Manual Handling & Ergonomics", description: "Proper lifting techniques and workstation setup" },
      { category: "Health", title: "Dust & Respiratory Protection", description: "Preventing respiratory issues from dust and fume exposure" },
      { category: "Health", title: "Mental Health & Wellbeing", description: "Workplace mental health awareness" },
      { category: "Health", title: "First Aid Awareness", description: "Basic first aid procedures and emergency response" },
      { category: "Health", title: "Substance Abuse Awareness", description: "Understanding the dangers of substance abuse at work" },
      { category: "Environment", title: "Waste Management & Segregation", description: "Proper waste handling and recycling procedures" },
      { category: "Environment", title: "Spill Response & Containment", description: "How to respond to chemical or oil spills" },
      { category: "Environment", title: "Water Conservation", description: "Reducing water usage in the shipyard" },
      { category: "Environment", title: "Energy Conservation", description: "Reducing energy consumption and carbon footprint" },
      { category: "Environment", title: "Marine Pollution Prevention", description: "Preventing contamination of harbour waters" },
      { category: "Risk", title: "Incident Reporting & Investigation", description: "How to report and investigate workplace incidents" },
      { category: "Risk", title: "Near Miss Reporting", description: "Importance of reporting near misses" },
      { category: "Risk", title: "Job Safety Analysis (JSA)", description: "Conducting proper job safety analysis" },
      { category: "Risk", title: "Permit to Work System", description: "Understanding the permit to work process at SAS" },
      { category: "Risk", title: "Emergency Preparedness", description: "Being prepared for emergencies in the shipyard" },
      { category: "Quality", title: "Document Control", description: "Proper handling and control of quality documents" },
      { category: "Quality", title: "Non-Conformance Reporting (NCR)", description: "Identifying and reporting quality non-conformances" },
      { category: "Quality", title: "Continuous Improvement (Kaizen)", description: "Embracing continuous improvement principles" },
      { category: "Quality", title: "ISO 9001:2015 Awareness", description: "Understanding our quality management system" },
      { category: "Quality", title: "Customer Focus & Satisfaction", description: "Meeting and exceeding customer expectations" },
      { category: "Quality", title: "Housekeeping & 5S", description: "Maintaining a clean and organized workplace" },
      { category: "General", title: "Team Communication", description: "Effective communication within the team" },
      { category: "General", title: "Time Management", description: "Managing time effectively at work" },
      { category: "General", title: "Workplace Ethics", description: "Professional conduct and ethics" },
    ]);

    return NextResponse.json({ message: "Seed data created successfully" }, { status: 201 });
  } catch (err) {
    console.error("Seed error:", err);
    return NextResponse.json(
      { error: "Failed to seed data. Check database connection." },
      { status: 500 }
    );
  }
}
