# UI Patterns — Responsive / Layout

รวม pattern มาตรฐานสำหรับปรับหน้าอื่นให้เป็นแนวเดียวกัน
อ้างอิงต้นแบบจาก `app/(main)/quote-list/*` (ทำครบทุก pattern แล้ว)

---

## 0. Global (แก้ที่ layout กลาง — มีผลทุกหน้า มีอยู่แล้ว ไม่ต้องทำซ้ำ)

**พื้นหลัง gradient อยู่ที่ `body` แบบ fixed** — `app/layout.tsx`
```
body className: "min-h-screen text-foreground bg-background
  bg-gradient-to-tl from-[#c09c42]/40 via-transparent to-transparent bg-fixed
  font-sans antialiased"
```

**Shell ปลดล็อคความสูงบนมือถือ** — `components/main-content.tsx`
```
"relative flex flex-col min-h-screen md:h-screen"
```
- มือถือ = โตตามเนื้อหา → document scroll → พื้นหลังเต็มเสมอ
- desktop = คง 100vh → internal scroll ยังทำงาน
- **อย่าใส่ gradient ที่ shell นี้อีก** (ย้ายไป body แล้ว จะซ้อนกันสี tint เข้มไม่สม่ำเสมอ)

---

## 1. Header title กันตัวอักษรตก (ellipsis)
```jsx
<div className="flex flex-row items-center justify-between gap-x-2 ...">
  <span className="... truncate min-w-0">{title}</span>
  <div className="... shrink-0">{ปุ่ม/toggle ข้าง ๆ}</div>
</div>
```
- `truncate min-w-0` ที่ตัวอักษร, `shrink-0` ที่ของข้าง ๆ, `gap-x-2` ที่ container

## 2. Container หน้า — bleed ใต้ NavBar + scroll ทั้งหน้า(มือถือ) / internal(desktop)
```jsx
<div className="flex flex-col md:h-[calc(100%+5rem)] -mt-20 pt-20 gap-y-3 md:overflow-hidden scrollbar-hide">
```
- `-mt-20 pt-20` = เนื้อหาทะลุใต้ navbar (navbar สูง 80px = 5rem)
- `md:h-[calc(100%+5rem)]` = desktop ชดเชยความสูงที่ถูก -mt-20 ดึงขึ้น (net-neutral)
- `gap-y-3` = ระยะห่างระหว่าง section สม่ำเสมอ **จากที่เดียว** — อย่าใส่ `my-*`/`pt-*` เดี่ยว ๆ ในแต่ละ section (เป็นต้นเหตุ gap ไม่สม่ำเสมอ)
- `scrollbar-hide` = ซ่อน scrollbar

## 3. Table → Card List บนมือถือ
```jsx
{/* desktop */}
<Table classNames={{ base: "hidden md:flex flex-col ..." }}> ... </Table>

{/* mobile */}
<div className="flex md:hidden flex-col gap-y-2 pb-4">
  {items.map((x) => <div className="... rounded-2xl p-3">...</div>)}
</div>
```
การ์ดมือถือ: Avatar + ชื่อ (`truncate`) + ยอด (`shrink-0`) + chip รายละเอียด (แสดงเฉพาะค่า > 0)

## 4. Search bar สูงเท่า filter อื่น (เมื่อ shared component ไม่รับ `classNames`)
```jsx
<div className="flex-1 [&_[data-slot=input-wrapper]]:h-12 [&_[data-slot=input-wrapper]]:min-h-12">
  <CmpInput ... />
</div>
```
เจาะ inputWrapper ของ HeroUI ผ่าน arbitrary selector แทนการแก้ component กลาง

## 5. Date filter — ข้อความ + ดินสอ → DatePicker
- state `editingDate`
- โหมดปกติ: กล่องข้อความช่วงวันที่ + ไอคอน `Calendar` + ปุ่มดินสอ `Pencil`
- กดดินสอ → `<Input type="date">` 2 ช่อง (จาก/ถึง) + ปุ่ม "ล้างวันที่" + ปุ่ม "เสร็จ"

## 6. Master–detail — Modal(มือถือ) / Split-pane(desktop)
```jsx
const selectItem = (id) => {
  setSelectedId(id);
  if (window.matchMedia("(max-width: 767px)").matches) setDetailOpen(true);
};

<div className="md:flex-1 md:min-h-0 flex flex-col md:flex-row gap-3">
  {/* preview: desktop only */}
  <div className="hidden md:flex flex-col flex-1 md:w-2/3 min-h-0 overflow-y-auto scrollbar-hide ...">
    {renderDetail(false)}
  </div>
  {/* list: มือถือเต็มจอ, desktop คอลัมน์ขวา */}
  <div className="flex flex-col md:w-1/3 md:min-h-0 md:overflow-y-auto scrollbar-hide gap-y-2 pb-4">...</div>
</div>

{/* mobile modal */}
<Modal isOpen={detailOpen} size="full" scrollBehavior="inside"
  classNames={{ wrapper: "md:hidden", backdrop: "md:hidden" }}>
  <ModalContent><ModalBody className="px-2 py-4 flex flex-col overflow-hidden">
    {renderDetail(true)}
  </ModalBody></ModalContent>
</Modal>
```
- responsive utility คุมทั้ง desktop/mobile; `matchMedia` เปิด modal เฉพาะมือถือ
- `classNames.wrapper/backdrop: "md:hidden"` กัน modal ค้างทับตอนหมุน/ย่อจอไป desktop

## 7. Detail panel — header/ปุ่มตรึง, เนื้อหาข้างในเลื่อน (prop `fillHeight`)
```jsx
<div className={`flex flex-col gap-y-3 ${fillHeight ? "h-full min-h-0" : ""}`}>
  <div className="... shrink-0">{header info}</div>
  <div className={fillHeight ? "flex-1 min-h-0 overflow-y-auto scrollbar-hide" : "contents"}>
    {เนื้อหายาวที่ต้องเลื่อน}
  </div>
  {hasActions && <div className="shrink-0 flex ...">{ปุ่ม}</div>}
</div>
```
- ส่ง `fillHeight` เฉพาะตอนอยู่ใน Modal (ให้เนื้อหาเลื่อนข้างใน) — pane/desktop ส่ง `false`
- `contents` = ตอนไม่ fill ให้ wrapper หายไป ไม่กระทบ layout เดิม
- guard `hasActions` กัน render แถบปุ่มเปล่า

## 8. Tabs — เลื่อนแนวนอนเมื่อ tab ล้น (ไม่ตก/ไม่ถูกตัด)
```jsx
<div className="flex items-center shrink-0">
  <div className="flex-1 min-w-0">
    <Tabs
      variant="underlined"
      classNames={{
        base: "w-full",
        tabList: "gap-4 w-full overflow-x-auto flex-nowrap scrollbar-hide",
      }}
    >
      {/* ...Tab... */}
    </Tabs>
  </div>
  {/* ปุ่มข้าง ๆ (ถ้ามี) */}
  <Button className="shrink-0 ml-2" />
</div>
```
- `overflow-x-auto flex-nowrap` = tab ที่ล้นจะเลื่อนแนวนอนแทนการตกบรรทัด/ถูกตัด
- `scrollbar-hide` = ซ่อน scrollbar (แนวเดียวกับ Table/Container)
- parent ต้อง `flex-1 min-w-0` เพื่อให้ tab bar จำกัดความกว้างและ overflow ทำงาน (โดยเฉพาะเมื่อมีปุ่มวางข้าง ๆ)
- อ้างอิง: `app/(main)/bills/page.tsx`

---

## เช็คลิสต์เวลาปรับหน้าใหม่
- [ ] Header: `truncate min-w-0` + ของข้าง ๆ `shrink-0`
- [ ] Container: pattern #2 (bleed + scroll + `gap-y-3` ที่เดียว)
- [ ] มี Table ไหม → เพิ่ม card list มือถือ (#3)
- [ ] Filter สูงเท่ากันไหม (#4)
- [ ] มี master-detail ไหม → modal มือถือ (#6) + `fillHeight` ถ้าเนื้อหายาว (#7)
- [ ] มี Tabs ที่อาจล้นไหม → เลื่อนแนวนอน (#8)
- [ ] ทดสอบ: มือถือ scroll ทั้งหน้า + พื้นหลังเต็ม, desktop internal scroll ปกติ
