# TripFlow 🌍✈️
> הפלטפורמה החכמה לניהול ותכנון לוחות זמנים דינמיים בחופשה, המרת תקציב וריכוז מסמכים במקום אחד.

## 📌 סקירה כללית (Overview)
TripFlow הוא אתר אינטראקטיבי המאפשר למטיילים לתכנן ולארגן את מסלול הטיול מראש, תוך ניהול דינמי של לוחות הזמנים, התקציב והמסמכים במהלך החופשה עצמה בצורה פשוטה, קלילה ומובנת.

## 💔 הבעיה (The Problem)
מטיילים רבים נתקלים בקושי רב בניהול הזמן במהלך החופשה. תכנונים מראש נוטים להשתבש בפועל עקב עיכובים באטרקציות, מה שמוביל להחמצת אתרים שנסגרים מוקדם. בנוסף, המטיילים נאלצים "לזגזג" בין אפליקציות שונות כדי לבדוק מסמכים (כרטיסי טיסה/מלון), לנהל תקציב במטבע מקומי ולראות מפה.

## 🎯 קהל היעד (Target Audience)
מטיילים עצמאיים, זוגות ומשפחות המחפשים פתרון ריכוזי, פשוט וקליל לתכנון הטיול שלהם, ללא צורך בהסתבכות עם מערכות מורכבות. קהל היעד משתמש באפליקציה הן בשלב התכנון בבית והן "תוך כדי תנועה" במהלך ימי החופשה.

## ⚔️ מתחרים ובידול (Competitors & Differentiation)
* **Wanderlog / TripIt:** אפליקציות בינלאומיות פופולריות לניהול מסלולים.
* **Google Sheets / Excel:** תכנון ידני מסורתי בטבלאות.

### 🌟 הערך הייחודי והבידול של TripFlow:
בשונה מהמתחרים, TripFlow לא רק מציג רשימת אתרים, אלא מנהל את **לוח הזמנים בצורה אקטיבית ודינמית**:
1. **טיימר משוער וחי:** לצד כל אטרקציה מוצג זמן שהייה משוער וטיימר ייעודי. המערכת משקללת את הזמנים ומתריעה למשתמש בזמן אמת האם יישאר לו מספיק זמן להגיע לאטרקציה הבאה לפני שעות הסגירה שלה.
2. **ציר זמן גמיש (Drag & Drop Timeline):** במידה והזמן אינו מספיק, המשתמש יכול להעביר בלחיצה או בגרירה את האטרקציה ליום המחרת, וציר הזמן מתעדכן אוטומטית.
3. **הכל במקום אחד (All-in-One):** שילוב ייחודי של ניהול זמנים, מפה מובנית, רשימת ציוד, ריכוז מסמכים רלוונטיים, ומערכת תקציב דו-מטבעית (שקלים והמרה אוטומטית לדולר).
---

## 📊 תרשים מודל הנתונים (ERD - Supabase)
הקשרים ומבנה בסיס הנתונים ממומשים ב-Supabase ומיוצגים באמצעות התרשים הבא:

```mermaid
erDiagram
    users {
        uuid id PK
        text full_name
    }
    trips {
        uuid id PK
        uuid user_id FK
        text name
        text destination
        date start_date
        date end_date
        text cover_emoji
        timestamp created_at
        text cover_image_url
        int stops
        text trip_type
        text local_currency
    }
    attractions {
        uuid id PK
        uuid trip_id FK
        text name
        text visit_time
        int duration_minutes
        int order_index
        timestamp created_at
        text description
        timestamptz actual_start_time
        int actual_duration_minutes
        text estimated_arrival_time
        text estimated_duration
        text opening_hours
        text status
        int scheduled_day
    }
    trip_documents {
        uuid id PK
        uuid trip_id FK
        uuid user_id FK
        text name
        text file_path
        text file_type
    }
    packing_items {
        uuid id PK
        uuid trip_id FK
        text item_name
        text category
        bool is_packed
        bool is_custom
        timestamp created_at
    }
    user_preferences {
        uuid id PK
        uuid user_id FK
        text category
        bool is_active
    }

    users ||--o{ trips : "creates"
    users ||--o{ user_preferences : "has"
    trips ||--o{ attractions : "contains"
    trips ||--o{ trip_documents : "includes"
    trips ||--o{ packing_items : "has_items"
## 🔌 שירותים חיצוניים ואינטגרציות (Integrations & Services)
הפרויקט נשען על השירותים החיצוניים הבאים לצורך מימוש הליבה העסקית ואבטחת המידע:

| שם השירות | סוג השירות | תפקיד במוצר ושימוש |
| :--- | :--- | :--- |
| **Supabase Auth / Google OAuth** | אוטנטיקציה ומערכת משתמשים | הרשמה והתחברות מאובטחת של משתמשים, וניהול הפרופיל וההעדפות שלהם. |
| **OpenAI API / LLM** | קריאות API (בינה מלאכותית) | ניתוח הלו"ז, חישוב זמני אטרקציות וביצוע סידור הלו"ז האוטומטי (Auto-Schedule). |
| **ExchangeRate API** | קריאות API (פיננסי) | המרת מטבע בזמן אמת של התקציב משקלים לדולרים ובחזרה לפי שערים עדכניים. |
| **Google Maps API / Leaflet** | אינטגרציית מפות וויזואליזציה | הצגת מיקומי האטרקציות על גבי מפה מובנית בתוך האפליקציה למשתמש. |

> ⚠️ **אבטחת מידע וניהול סודות:** כל מפתחות ה-API והסודות החיצוניים (כמו מפתחות OpenAI ו-Supabase) מוסתרים בצורה מאובטחת באמצעות משתני סביבה (`.env`) ואינם חשופים בקוד צד הלקוח, בהתאם לדרישות האבטחה המחמירות.
