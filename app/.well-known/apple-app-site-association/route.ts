import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    {
      applinks: {
        apps: [],
        details: [
          {
            appID: '3PUMVUB2ZB.com.nbstyle.athlex',
            paths: ['/wod/*', '/tournament/*', '/daily/*', '/profile/*', '/user/*', '/inter/*'],
          },
        ],
      },
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
    },
  );
}
