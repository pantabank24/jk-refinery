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

**Shell = 100vh คงที่** — `components/main-content.tsx`
```
"relative flex flex-col h-screen"
```
- ทุกหน้าใช้ **internal scroll** (ตรึง header/filter, scroll เฉพาะเนื้อหา) → ไม่มี document scroll → พื้นหลังเต็มเสมอ
- **อย่าใส่ gradient ที่ shell นี้** (อยู่ที่ body `bg-fixed` แล้ว จะซ้อนกันสี tint เข้มไม่สม่ำเสมอ)

---

## 1. Header title กันตัวอักษรตก (ellipsis)
```jsx
<div className="flex flex-row items-center justify-between gap-x-2 ...">
  <span className="... truncate min-w-0">{title}</span>
  <div className="... shrink-0">{ปุ่ม/toggle ข้าง ๆ}</div>
</div>
```
- `truncate min-w-0` ที่ตัวอักษร, `shrink-0` ที่ของข้าง ๆ, `gap-x-2` ที่ container
- **ระยะเว้น Title จากขอบบน (ใต้ navbar) = ชิดขอบ ไม่ใส่ pt เพิ่มที่ header**
  - Pattern #2 มี `pt-20` = ชิด navbar พอดีอยู่แล้ว → header ใส่แค่ `px-1` ไม่ต้องมี `pt-*`
  - หน้าที่ยังไม่ใช้ bleed pattern (root `h-full`) ก็ **อย่าใส่ `pt-5`** เพราะ `<main>` มี `pt-20` ให้ clearance ใต้ navbar อยู่แล้ว

## 2. Container หน้า

### 2A. หน้าที่มี "ค้นหา / Filter" (ค่าเริ่มต้น — ใช้กับ list page ส่วนใหญ่)
พฤติกรรมต่างกันตาม breakpoint:
- **มือถือ:** ตรึง Header + ค้นหา + Filter / scroll ตั้งแต่ Overview → Overview เลื่อนไปพร้อม list
- **Desktop:** ตรึง Header + ค้นหา + Filter + **Overview + Tabs** / ให้ content scroll ในตัวเอง (Overview ตรึง)

```jsx
<div className="flex flex-col h-full gap-y-3">        {/* root ตรึง — ห้ามใส่ overflow */}
  {/* Header */}   <div className="... shrink-0">...</div>
  {/* Filter */}   <div className="... shrink-0">...</div>   {/* ค้นหา+filter ตรึง ใช้สะดวก */}

  {/* Scroll region: มือถือ scroll รวม / desktop ไม่ scroll (ให้ content ทำเอง) */}
  <div className="flex-1 min-h-0 overflow-y-auto md:overflow-hidden scrollbar-hide flex flex-col gap-y-3">
    <Overview />
    <Tabs />
    {/* Content: มือถือ natural (เลื่อนไปกับ wrapper) / desktop fill+scroll ในตัวเอง */}
    <div className="flex flex-col md:flex-1 md:min-h-0 md:overflow-y-auto md:scrollbar-hide">
      ...list / table / split-pane...
    </div>
  </div>
</div>
```
- กุญแจ 2 จุด: **wrapper** `overflow-y-auto md:overflow-hidden` + **content** `md:flex-1 md:min-h-0 md:overflow-y-auto`
- **ทำไมไม่ bleed:** ค้นหา/Filter ต้องเห็นตลอด กดง่าย → ตรึงนอก scroll region
- ถ้า content เป็น split-pane (master-detail #6) ก็ใช้ pattern เดียวกัน (pane เป็นตัว `md:flex-1 md:min-h-0` scroll เอง)
- `gap-y-3` ทั้ง root และ wrapper = ระยะห่างสม่ำเสมอ **จากที่เดียว** (อย่าใส่ `my-*`/`pt-*` เดี่ยว ๆ)

**ถ้ามี Tabs:** มือถือให้ Tabs ขึ้นไปตรึงใต้ Filter (เหนือ scroll region) / desktop อยู่หลัง Overview เหมือนเดิม
เนื่องจากตำแหน่งอยู่คนละฝั่งขอบ scroll → render Tabs เป็นตัวแปรเดียว วาง 2 จุด (คุมด้วย state เดียว)
```jsx
const tabsEl = <Tabs selectedKey={activeTab} onSelectionChange={...}>...</Tabs>;

{/* หลัง Filter (นอก scroll region) */}
<div className="shrink-0 md:hidden">{tabsEl}</div>

<div className="flex-1 min-h-0 overflow-y-auto md:overflow-hidden scrollbar-hide flex flex-col gap-y-3">
  <Overview />
  {/* หลัง Overview (ใน wrapper, desktop เท่านั้น) */}
  <div className="hidden md:block shrink-0">{tabsEl}</div>
  <Content ... />
</div>
```

### 2B. หน้าที่ **ไม่มี** ค้นหา/Filter — bleed ใต้ navbar ได้
```jsx
<div className="flex flex-col h-[calc(100%+5rem)] -mt-20 pt-20 gap-y-3 overflow-y-auto scrollbar-hide">
```
- `-mt-20 pt-20` = เนื้อหา scroll ลอดขึ้นใต้ navbar (navbar สูง 80px = 5rem), `h-[calc(100%+5rem)]` ชดเชยความสูง
- ใช้ **เฉพาะหน้าที่ไม่มี filter** เท่านั้น (bleed ทำให้ของบนสุดเลื่อนหายได้ ไม่เหมาะกับ filter)

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
- [ ] Container: มีค้นหา/Filter ไหม → ใช้ #2A (ตรึง filter, scroll ตั้งแต่ Overview) / ไม่มี → #2B (bleed ได้)
- [ ] มี Table ไหม → เพิ่ม card list มือถือ (#3)
- [ ] Filter สูงเท่ากันไหม (#4)
- [ ] มี master-detail ไหม → modal มือถือ (#6) + `fillHeight` ถ้าเนื้อหายาว (#7)
- [ ] มี Tabs ที่อาจล้นไหม → เลื่อนแนวนอน (#8)
- [ ] ทดสอบ: มือถือ scroll ทั้งหน้า + พื้นหลังเต็ม, desktop internal scroll ปกติ
