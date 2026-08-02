export async function POST() {
  return Response.json(
    { error: "Merch checkout is unavailable." },
    { status: 410 },
  );
}
