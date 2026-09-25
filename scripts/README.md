# Finding a school on ArbiterLive

ArbiterLive assigns `entityId` alphabetically by school name across its entire
national database. That was verified against eight known New Jersey ids and it
makes finding a school a binary search rather than a crawl. The ordering holds
to roughly id 26300; anything added since is appended unsorted at the end,
which is where Eastside Camden sits.

Two traps, both of which produced wrong answers on the first attempt:

- **Names repeat.** There are three Camden High Schools, seven Senecas and two
  Woodrow Wilsons. Landing on a name match proves nothing. The test that works
  is to pull the candidate's schedule and count how many opponents are other
  Olympic Conference schools: the New Jersey one is above 50%, a same-named
  school elsewhere is at 0%.
- **Schools get renamed.** The conference's Woodrow Wilson High School is
  listed as "Eastside High School - Camden", and Eastern is "Eastern Regional
  High School". Search for what Arbiter calls them, which is most easily found
  by reading the opponent names off a confirmed school's schedule.

Seven member schools have never uploaded a crest to ArbiterLive and show its
default shield, so those come from MaxPreps. Do not take the first `mascotUrl`
on a MaxPreps page: there are around 37 of them and nearly all are opponents.
Moorestown's page leads with Cherry Hill East's crest, which is exactly the
mistake that shipped on the first pass. Match on the school name beside it.
Moorestown has no crest on MaxPreps at all; its own DigitalSports site has one.
