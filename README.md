# 우리 아이 동화책 (모노레포)

개인화 동화책 앱. Expo(React Native) + Node(Fastify) + Prisma + BullMQ.
이 폴더는 **STEP 0 스캐폴드** — 앱에서 버튼을 누르면 API `/health`가 응답하는 최소 골격.

## 사전 요구
- Node 20+, pnpm 9+, Docker Desktop

## 시작하기
```bash
# 1) 의존성
pnpm install

# 2) 환경변수
cp apps/api/.env.example apps/api/.env
cp apps/mobile/.env.example apps/mobile/.env

# 3) 로컬 인프라 (Postgres + Redis)
pnpm infra:up

# 4) DB 스키마 반영
pnpm db:push

# 5) API 서버 (http://localhost:4000/health)
pnpm api

# 6) 워커 (다른 터미널)
pnpm worker

# 7) Expo 앱 (다른 터미널)
pnpm app
```

앱이 뜨면 **"API 연결 확인"** 버튼을 눌러 `/health` 응답이 보이면 STEP 0 완료.

## 메모
- 실기기/시뮬레이터에서 `localhost`가 안 잡히면 `apps/mobile/.env`의 `EXPO_PUBLIC_API_URL`을 PC의 LAN IP로 바꾼다 (예: `http://192.168.0.10:4000`).
- Expo SDK/패키지 버전은 설치 후 `cd apps/mobile && npx expo install --fix`로 정렬을 권장.
- 다음 단계(STEP 1~)는 `앱_프로젝트구조_및_구현로드맵.md` 참고.

## STEP 1 (인증 + 앱 셸 + 디자인) 적용 시
스키마와 의존성이 바뀌었으니 한 번 더:
```bash
pnpm install                                  # 새 의존성(jwt, bcrypt, zustand, secure-store…)
pnpm db:push                                  # User에 passwordHash 추가 반영
cd apps/mobile && npx expo install            # 네이티브 모듈 버전 정렬(reanimated, gesture-handler, secure-store)
cd ../.. && pnpm api                          # API
pnpm app                                       # 앱 → 회원가입/로그인 후 탭(홈·내 책장·설정)
```
- `JWT_SECRET`을 `apps/api/.env`에 설정(운영에선 강한 값).
- 앱 첫 실행 → 로그인 화면 → 회원가입 → 탭 진입. 설정 탭에서 계정·서버상태·로그아웃.
- 소셜 로그인(Apple/Google)은 이후 단계에서 추가.

## STEP 2 (캐릭터 생성 — 첫 AI 파이프라인) 적용 시
의존성·스키마가 또 바뀌었으니:
```bash
pnpm install                                  # openai, @fastify/static, expo-image-picker 등
pnpm db:push                                  # Character에 status/personality 반영
cd apps/mobile && npx expo install            # expo-image-picker 정렬
cd ../.. && pnpm api                          # API
pnpm worker                                    # 워커 (반드시 같이! 생성은 워커가 처리)
pnpm app
```
- **`apps/api/.env`의 `OPENAI_API_KEY`에 실제 키 필수** — 여기서 캐릭터 시트를 생성합니다.
- 흐름: 홈 → "캐릭터부터 만들기" → 이름·역할·성격·(사진) → "캐릭터 만들기" → 진행바(워커가 OpenAI 호출) → 완료되면 캐릭터 시트 표시 → 🔄수정/삭제, 여러 명 추가.
- 생성 이미지는 `apps/api/storage/`에 저장되고 `/files/...`로 서빙됩니다.
- ⚠ **실기기**에서 테스트하면 이미지 URL의 `localhost`가 안 잡힙니다 → `apps/api/.env`의 `PUBLIC_URL`과 `apps/mobile/.env`의 `EXPO_PUBLIC_API_URL`을 PC의 LAN IP로 맞추세요. (웹·시뮬레이터는 localhost 그대로 OK)

## STEP 3 (대화 기획 + 스토리보드 미리보기) 적용 시
```bash
pnpm install
pnpm db:push          # Character.age, Story.storyboardUrl 반영
pnpm api
pnpm worker           # character + storyboard 두 워커가 함께 돕니다
pnpm app
```
- 흐름: 홈 → 캐릭터 만들기(이름·나이·역할·성격 **선택 또는 직접 입력** + 사진) → "다음" → **대화로 컨셉 잡기**(선택지 칩 + 직접 입력, 클로드식) → 구성 확정 시 자동으로 **스토리보드 미리보기**(한 장 + 장면별 동화 글 + 등장 캐릭터 시트들) → "다시 컨셉 잡기" 또는 "동화책 만들기"(STEP 4).
- gpt-image-2의 다중 레퍼런스로 우리 아이 + 추가 캐릭터를 한 장에 일관되게 그립니다.

## STEP 4 (승인 → 동화책 1권 + 내 책장) 적용 시
```bash
pnpm install && pnpm db:push && pnpm api
pnpm worker      # character · storyboard · book 세 워커가 함께 돕니다
pnpm app
```
- 흐름: 스토리보드 미리보기 → "이 스토리보드로 동화책 만들기" → **각 장면을 고화질로 순차 생성**(완료되는 페이지부터 화면에 나타남) → 완성되면 **내 책장**에 저장.
- 내 책장 탭에서 만든 동화책을 다시 열어볼 수 있습니다.
- (다음 후보) PDF 내보내기/공유, 페이지 넘김 뷰어, 결제·크레딧.

## STEP 5 (반응형 뷰어 + PDF) 적용 시
```bash
pnpm install
cd apps/mobile && npx expo install   # expo-print, expo-sharing 정렬
cd ../.. && pnpm app
```
- 완성된 동화책은 기기에 맞춰 자동 표시: **태블릿 = 가로로 넘기는 책장식**(페이지 스와이프 + n/총 페이지), **폰 = 세로 웹툰식** 스크롤.
- 뷰어 상단 **PDF** 버튼 → 네이티브는 공유 시트로 PDF 저장/전송, 웹은 인쇄 창으로 PDF 저장.

## 구조
```
apps/mobile   Expo 앱 — (auth), (tabs: 홈·내책장·설정), create/(characters·concept·storyboard·book), 반응형 BookViewer + PDF
```
apps/api      Fastify + 인증 + 캐릭터/기획/스토리보드 생성(OpenAI) + 로컬 스토리지 + BullMQ(character·storyboard 워커) + Prisma
packages/shared  공유 타입(StoryState, Job, CharacterRecord, StoryRecord 등)
```
