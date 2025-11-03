# Tri-force Koenji施設予約システム ドメイン駆動設計モデル

## 1. ドメイン分析

### 1.1 ビジネスドメイン
**施設予約管理ドメイン**
- 会員が施設を予約し、利用スケジュールを管理するビジネス領域
- 施設の有効活用とサービス品質向上を目的とする

### 1.2 問題領域の特定
- 施設の重複予約防止
- 定員管理による利用制限
- 予約データの一元管理
- 利用者への適切な情報提供

## 2. ドメインモデル

### 2.1 集約 (Aggregates)

#### 2.1.1 予約集約 (Reservation Aggregate)
```javascript
// 予約集約ルート
class Reservation {
  constructor(reservationId, member, facility, timeSlot, remarks) {
    this.reservationId = reservationId;
    this.member = member;
    this.facility = facility;
    this.timeSlot = timeSlot;
    this.remarks = remarks;
    this.status = ReservationStatus.PENDING;
    this.createdAt = new Date();
  }
  
  // ビジネスルール：予約の確定
  confirm() {
    if (this.status !== ReservationStatus.PENDING) {
      throw new Error('予約は既に処理済みです');
    }
    this.status = ReservationStatus.CONFIRMED;
  }
  
  // ビジネスルール：予約のキャンセル
  cancel() {
    if (this.status === ReservationStatus.COMPLETED) {
      throw new Error('完了した予約はキャンセルできません');
    }
    this.status = ReservationStatus.CANCELLED;
  }
  
  // ビジネスルール：予約の変更
  changeTimeSlot(newTimeSlot) {
    if (this.status !== ReservationStatus.CONFIRMED) {
      throw new Error('確定した予約のみ変更可能です');
    }
    this.timeSlot = newTimeSlot;
  }
}
```

#### 2.1.2 施設集約 (Facility Aggregate)
```javascript
// 施設集約ルート
class Facility {
  constructor(facilityId, name, capacity, operatingHours) {
    this.facilityId = facilityId;
    this.name = name;
    this.capacity = capacity;
    this.operatingHours = operatingHours;
    this.maintenanceSchedule = [];
  }
  
  // ビジネスルール：利用可能時間の確認
  isAvailableAt(timeSlot) {
    return this.operatingHours.includes(timeSlot) && 
           !this.isUnderMaintenance(timeSlot);
  }
  
  // ビジネスルール：定員チェック
  canAccommodate(currentReservations) {
    return currentReservations.length < this.capacity;
  }
  
  // ビジネスルール：メンテナンス時間の確認
  isUnderMaintenance(timeSlot) {
    return this.maintenanceSchedule.some(maintenance => 
      maintenance.overlaps(timeSlot));
  }
}
```

#### 2.1.3 会員集約 (Member Aggregate)
```javascript
// 会員集約ルート
class Member {
  constructor(memberId, email, name, contactInfo) {
    this.memberId = memberId;
    this.email = email;
    this.name = name;
    this.contactInfo = contactInfo;
    this.membershipStatus = MembershipStatus.ACTIVE;
    this.reservationHistory = [];
  }
  
  // ビジネスルール：予約履歴の追加
  addReservationHistory(reservation) {
    this.reservationHistory.push(reservation);
  }
  
  // ビジネスルール：会員資格の確認
  isEligibleForReservation() {
    return this.membershipStatus === MembershipStatus.ACTIVE;
  }
}
```

### 2.2 値オブジェクト (Value Objects)

#### 2.2.1 時間枠 (TimeSlot)
```javascript
class TimeSlot {
  constructor(startTime, endTime) {
    if (startTime >= endTime) {
      throw new Error('開始時刻は終了時刻より前である必要があります');
    }
    this.startTime = startTime;
    this.endTime = endTime;
  }
  
  // 時間枠の重複チェック
  overlaps(other) {
    return this.startTime < other.endTime && 
           this.endTime > other.startTime;
  }
  
  // 時間枠の長さ
  duration() {
    return this.endTime - this.startTime;
  }
  
  // 等価性チェック
  equals(other) {
    return this.startTime.getTime() === other.startTime.getTime() &&
           this.endTime.getTime() === other.endTime.getTime();
  }
}
```

#### 2.2.2 連絡先情報 (ContactInfo)
```javascript
class ContactInfo {
  constructor(phoneNumber, emailAddress) {
    this.phoneNumber = this.validatePhoneNumber(phoneNumber);
    this.emailAddress = this.validateEmail(emailAddress);
  }
  
  validatePhoneNumber(phoneNumber) {
    const phoneRegex = /^[0-9-]+$/;
    if (!phoneRegex.test(phoneNumber)) {
      throw new Error('無効な電話番号形式です');
    }
    return phoneNumber;
  }
  
  validateEmail(emailAddress) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailAddress)) {
      throw new Error('無効なメールアドレス形式です');
    }
    return emailAddress;
  }
}
```

### 2.3 ドメインサービス (Domain Services)

#### 2.3.1 予約可能性判定サービス
```javascript
class ReservationAvailabilityService {
  constructor(reservationRepository, facilityRepository) {
    this.reservationRepository = reservationRepository;
    this.facilityRepository = facilityRepository;
  }
  
  // 予約可能性の判定
  async isReservationAvailable(facilityId, timeSlot) {
    const facility = await this.facilityRepository.findById(facilityId);
    if (!facility) {
      throw new Error('施設が見つかりません');
    }
    
    // 施設の利用可能時間チェック
    if (!facility.isAvailableAt(timeSlot)) {
      return false;
    }
    
    // 既存予約の確認
    const existingReservations = await this.reservationRepository
      .findByFacilityAndTimeSlot(facilityId, timeSlot);
    
    // 定員チェック
    return facility.canAccommodate(existingReservations);
  }
}
```

#### 2.3.2 予約競合解決サービス
```javascript
class ReservationConflictResolutionService {
  // 予約競合の解決
  resolveConflict(reservations, facility) {
    // 先着順での解決
    const sortedReservations = reservations.sort((a, b) => 
      a.createdAt - b.createdAt);
    
    const confirmedReservations = [];
    const rejectedReservations = [];
    
    for (const reservation of sortedReservations) {
      if (confirmedReservations.length < facility.capacity) {
        reservation.confirm();
        confirmedReservations.push(reservation);
      } else {
        reservation.reject();
        rejectedReservations.push(reservation);
      }
    }
    
    return {
      confirmed: confirmedReservations,
      rejected: rejectedReservations
    };
  }
}
```

### 2.4 ドメインイベント (Domain Events)

#### 2.4.1 予約関連イベント
```javascript
// 予約完了イベント
class ReservationConfirmedEvent {
  constructor(reservation) {
    this.eventId = generateUUID();
    this.reservation = reservation;
    this.occurredAt = new Date();
    this.eventType = 'ReservationConfirmed';
  }
}

// 予約キャンセルイベント
class ReservationCancelledEvent {
  constructor(reservation, reason) {
    this.eventId = generateUUID();
    this.reservation = reservation;
    this.reason = reason;
    this.occurredAt = new Date();
    this.eventType = 'ReservationCancelled';
  }
}

// 予約変更イベント
class ReservationModifiedEvent {
  constructor(reservation, oldTimeSlot, newTimeSlot) {
    this.eventId = generateUUID();
    this.reservation = reservation;
    this.oldTimeSlot = oldTimeSlot;
    this.newTimeSlot = newTimeSlot;
    this.occurredAt = new Date();
    this.eventType = 'ReservationModified';
  }
}
```

## 3. リポジトリ (Repositories)

### 3.1 予約リポジトリ
```javascript
class ReservationRepository {
  // 予約IDによる検索
  async findById(reservationId) {
    // 実装詳細
  }
  
  // 施設と時間枠による検索
  async findByFacilityAndTimeSlot(facilityId, timeSlot) {
    // 実装詳細
  }
  
  // 会員による検索
  async findByMember(memberId) {
    // 実装詳細
  }
  
  // 予約の保存
  async save(reservation) {
    // 実装詳細
  }
  
  // 予約の削除
  async delete(reservationId) {
    // 実装詳細
  }
}
```

### 3.2 施設リポジトリ
```javascript
class FacilityRepository {
  // 施設IDによる検索
  async findById(facilityId) {
    // 実装詳細
  }
  
  // 全施設の取得
  async findAll() {
    // 実装詳細
  }
  
  // 利用可能な施設の検索
  async findAvailableAt(timeSlot) {
    // 実装詳細
  }
}
```

## 4. アプリケーションサービス (Application Services)

### 4.1 予約アプリケーションサービス
```javascript
class ReservationApplicationService {
  constructor(
    reservationRepository,
    facilityRepository,
    memberRepository,
    availabilityService,
    eventBus
  ) {
    this.reservationRepository = reservationRepository;
    this.facilityRepository = facilityRepository;
    this.memberRepository = memberRepository;
    this.availabilityService = availabilityService;
    this.eventBus = eventBus;
  }
  
  // 予約の作成
  async createReservation(command) {
    // 会員の確認
    const member = await this.memberRepository.findById(command.memberId);
    if (!member || !member.isEligibleForReservation()) {
      throw new Error('予約権限がありません');
    }
    
    // 施設の確認
    const facility = await this.facilityRepository.findById(command.facilityId);
    if (!facility) {
      throw new Error('施設が見つかりません');
    }
    
    // 予約可能性の確認
    const timeSlot = new TimeSlot(command.startTime, command.endTime);
    const isAvailable = await this.availabilityService
      .isReservationAvailable(command.facilityId, timeSlot);
    
    if (!isAvailable) {
      throw new Error('指定された時間は予約できません');
    }
    
    // 予約の作成
    const reservation = new Reservation(
      generateUUID(),
      member,
      facility,
      timeSlot,
      command.remarks
    );
    
    reservation.confirm();
    
    // 予約の保存
    await this.reservationRepository.save(reservation);
    
    // イベントの発行
    const event = new ReservationConfirmedEvent(reservation);
    await this.eventBus.publish(event);
    
    return reservation;
  }
  
  // 予約のキャンセル
  async cancelReservation(reservationId, reason) {
    const reservation = await this.reservationRepository.findById(reservationId);
    if (!reservation) {
      throw new Error('予約が見つかりません');
    }
    
    reservation.cancel();
    await this.reservationRepository.save(reservation);
    
    const event = new ReservationCancelledEvent(reservation, reason);
    await this.eventBus.publish(event);
    
    return reservation;
  }
}
```

## 5. 境界づけられたコンテキスト (Bounded Contexts)

### 5.1 予約管理コンテキスト
```
責任範囲:
- 予約の作成・変更・キャンセル
- 施設の利用可能性管理
- 予約競合の解決

主要な概念:
- 予約 (Reservation)
- 施設 (Facility)
- 時間枠 (TimeSlot)
- 会員 (Member)
```

### 5.2 会員管理コンテキスト
```
責任範囲:
- 会員情報の管理
- 会員資格の確認
- 利用履歴の管理

主要な概念:
- 会員 (Member)
- 会員資格 (Membership)
- 利用履歴 (UsageHistory)
```

### 5.3 施設管理コンテキスト
```
責任範囲:
- 施設情報の管理
- 営業時間の管理
- メンテナンススケジュール

主要な概念:
- 施設 (Facility)
- 営業時間 (OperatingHours)
- メンテナンス (Maintenance)
```

## 6. ユビキタス言語 (Ubiquitous Language)

### 6.1 用語集
```
予約 (Reservation): 会員が施設を利用するための事前申し込み
施設 (Facility): 予約可能な設備やスペース
時間枠 (TimeSlot): 予約の開始時刻と終了時刻で定義される時間範囲
定員 (Capacity): 同じ時間枠で利用可能な最大人数
会員 (Member): 施設を利用する資格を持つ人
利用可能性 (Availability): 特定の時間枠で施設を予約できる状態
競合 (Conflict): 同じ時間枠で定員を超える予約申し込みがある状態
```

### 6.2 ビジネスルール
```
- 予約は会員のみが行うことができる
- 同じ時間枠での予約は施設の定員まで
- 予約の変更は利用開始時刻の24時間前まで可能
- キャンセルは利用開始時刻の2時間前まで可能
- 営業時間外の予約は不可
- メンテナンス時間中の予約は不可
```

## 7. アーキテクチャパターン

### 7.1 ヘキサゴナルアーキテクチャ
```
Port (インターフェース):
- ReservationPort: 予約操作のインターフェース
- FacilityPort: 施設操作のインターフェース
- NotificationPort: 通知のインターフェース

Adapter (実装):
- GoogleSheetsReservationAdapter: スプレッドシートでの予約管理
- GoogleCalendarAdapter: カレンダーでの予約表示
- EmailNotificationAdapter: メール通知
```

### 7.2 CQRS (Command Query Responsibility Segregation)
```javascript
// コマンド側
class CreateReservationCommand {
  constructor(memberId, facilityId, startTime, endTime, remarks) {
    this.memberId = memberId;
    this.facilityId = facilityId;
    this.startTime = startTime;
    this.endTime = endTime;
    this.remarks = remarks;
  }
}

// クエリ側
class ReservationQuery {
  constructor(queryHandler) {
    this.queryHandler = queryHandler;
  }
  
  async findReservationsByMember(memberId) {
    return await this.queryHandler.findReservationsByMember(memberId);
  }
  
  async findAvailableTimeSlots(facilityId, date) {
    return await this.queryHandler.findAvailableTimeSlots(facilityId, date);
  }
}
```

## 8. 実装マッピング

### 8.1 現在の実装との対応
```javascript
// 現在のcode.gsの関数をDDDの概念にマッピング
const domainMapping = {
  // 集約
  Reservation: 'フォームデータ + 予約ロジック',
  Facility: '施設情報 + 定員管理',
  
  // ドメインサービス
  ReservationAvailabilityService: 'isTimeSlotFull関数',
  
  // リポジトリ
  ReservationRepository: 'saveFormDataToSpreadsheet関数',
  
  // アプリケーションサービス
  ReservationApplicationService: 'processFormData関数',
  
  // 値オブジェクト
  TimeSlot: 'parseStartTime + calculateEndTime関数',
  ContactInfo: 'フォームバリデーション'
};
```

### 8.2 リファクタリング推奨事項
1. **集約の分離**: 予約、施設、会員を独立した集約として管理
2. **ドメインサービスの導入**: 複雑なビジネスロジックを専用サービスに移動
3. **値オブジェクトの活用**: 時間枠、連絡先情報などの値オブジェクト化
4. **イベント駆動アーキテクチャ**: ドメインイベントを使用した疎結合設計
5. **リポジトリパターン**: データアクセスロジックの抽象化

## 9. 拡張性の考慮

### 9.1 新機能追加時の考慮点
- 新しい集約やドメインサービスの必要性
- 既存のビジネスルールへの影響
- 境界づけられたコンテキストの変更
- ドメインイベントの追加

### 9.2 技術的負債の軽減
- 現在の手続き型コードからオブジェクト指向への移行
- ビジネスロジックとインフラストラクチャの分離
- テスタビリティの向上
- 保守性の向上

---

**注意**: このドメインモデルは既存システムの分析に基づいて作成されています。実際の実装時には、ビジネス要件の詳細な確認と段階的なリファクタリングが推奨されます。
