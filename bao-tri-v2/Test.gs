/**
 * HỆ THỐNG BẢO TRÌ TOÀN NHÀ MÁY — v2
 * ============================================================================
 * SCRIPT TEST ĐỘC LẬP — chạy bằng dữ liệu giả, KHÔNG đọc/ghi bất kỳ sheet nào.
 *
 * Chạy: menu 🔧 Bảo trì → "🧪 Chạy test logic", hoặc Run hàm chayTest() trong editor.
 * Dùng để kiểm tra lại logic ca / lịch trực / lọc danh bạ mỗi khi sửa code,
 * trước khi deploy lên bản đang chạy thật.
 */

// ============================================================================
// Khung assert tối giản
// ============================================================================

function _kiemTra_(kq) {
  return {
    bang: function (ten, thucTe, mongDoi) {
      const a = JSON.stringify(thucTe);
      const b = JSON.stringify(mongDoi);
      if (a === b) kq.dat++;
      else kq.loi.push('✗ ' + ten + '\n    mong đợi: ' + b + '\n    thực tế : ' + a);
    },
  };
}

/** Date từ chuỗi 'yyyy-MM-ddTHH:mm', luôn hiểu là giờ Việt Nam. */
function _luc_(s) {
  return new Date(s + ':00+07:00');
}

/** Bảng ca giả — dựng từ chính hằng số CA_MAC_DINH nên test luôn cả giá trị seed. */
function _cauHinhCaGia_() {
  const map = {};
  CA_MAC_DINH.forEach(function (r) {
    map[r[0]] = { moTa: r[1], tu: gioSangPhut_(r[2]), den: gioSangPhut_(r[3]), coCaDem: r[4] };
  });
  return map;
}

// ============================================================================
// Bộ test
// ============================================================================

function chayTest() {
  const kq = { dat: 0, loi: [] };
  const t = _kiemTra_(kq);
  const cfg = _cauHinhCaGia_();

  // --- 1. Chuẩn hoá giờ ------------------------------------------------------
  t.bang('gioSangPhut 07:00', gioSangPhut_('07:00'), 420);
  t.bang('gioSangPhut 06:30', gioSangPhut_('06:30'), 390);
  t.bang('chuanHoaGio 7:5 sai định dạng', chuanHoaGio_('7:5'), null);
  t.bang('chuanHoaGio 7:05', chuanHoaGio_('7:05'), '07:05');

  // --- 2. Xác định ca --------------------------------------------------------
  // Dệt 07:00–18:00, có ca đêm.
  t.bang('DET 10:00 → ca ngày',
    xacDinhCa_('DET', _luc_('2026-08-03T10:00'), cfg),
    { ca: 'N', ngayCa: '2026-08-03', nhomCa: 'DET' });
  t.bang('DET 19:00 → ca đêm cùng ngày',
    xacDinhCa_('DET', _luc_('2026-08-03T19:00'), cfg),
    { ca: 'D', ngayCa: '2026-08-03', nhomCa: 'DET' });
  t.bang('DET 02:00 rạng sáng → ca đêm của HÔM TRƯỚC',
    xacDinhCa_('DET', _luc_('2026-08-04T02:00'), cfg),
    { ca: 'D', ngayCa: '2026-08-03', nhomCa: 'DET' });
  t.bang('DET đúng 18:00 → đã sang ca đêm',
    xacDinhCa_('DET', _luc_('2026-08-03T18:00'), cfg).ca, 'D');

  // Tổ điện đổi ca lúc 17:30 — lệch với giờ bộ phận Dệt.
  t.bang('TO_DIEN 17:45 → ca đêm',
    xacDinhCa_('TO_DIEN', _luc_('2026-08-03T17:45'), cfg).ca, 'D');
  t.bang('TO_DIEN 06:00 → ca đêm của hôm trước',
    xacDinhCa_('TO_DIEN', _luc_('2026-08-03T06:00'), cfg),
    { ca: 'D', ngayCa: '2026-08-02', nhomCa: 'TO_DIEN' });

  // Tổ cơ khí không làm đêm → ngoài giờ là không có ca nào.
  t.bang('TO_CO_KHI 08:00 → ca ngày',
    xacDinhCa_('TO_CO_KHI', _luc_('2026-08-03T08:00'), cfg).ca, 'N');
  t.bang('TO_CO_KHI 22:00 → không có ca',
    xacDinhCa_('TO_CO_KHI', _luc_('2026-08-03T22:00'), cfg).ca, null);

  // Nhóm ca lạ → rơi về MAC_DINH, không được văng lỗi.
  t.bang('Nhóm ca không tồn tại → dùng MAC_DINH',
    xacDinhCa_('KHONG_CO_NHOM_NAY', _luc_('2026-08-03T08:00'), cfg).ca, 'N');

  // --- 3. Lịch trực ----------------------------------------------------------
  const lich = { TH01: { '03': 'N', '04': 'ND' } };
  t.bang('TH01 ngày 03 ca N → có trực', coTrucKhong_(lich, 'TH01', '2026-08-03', 'N'), true);
  t.bang('TH01 ngày 03 ca D → không trực', coTrucKhong_(lich, 'TH01', '2026-08-03', 'D'), false);
  t.bang('TH01 ngày 04 (ND) ca D → có trực', coTrucKhong_(lich, 'TH01', '2026-08-04', 'D'), true);
  t.bang('TH99 không có trong lịch', coTrucKhong_(lich, 'TH99', '2026-08-03', 'N'), false);
  t.bang('Lịch null (chưa tạo tháng)', coTrucKhong_(null, 'TH01', '2026-08-03', 'N'), false);
  t.bang('thangCuaNgay', thangCuaNgay_('2026-08-03'), '08/2026');

  // --- 4. Lọc chuyên môn / bộ phận -------------------------------------------
  t.bang('Thợ điện + lỗi điện', hopChuyenMon_('DIEN', 'DIEN'), true);
  t.bang('Thợ điện + lỗi cơ khí', hopChuyenMon_('DIEN', 'CO_KHI'), false);
  t.bang('Thợ CA_HAI + lỗi cơ khí', hopChuyenMon_('CA_HAI', 'CO_KHI'), true);
  t.bang('Lỗi KHONG_RO khớp mọi thợ', hopChuyenMon_('DIEN', 'KHONG_RO'), true);
  t.bang('Phụ trách trống = mọi bộ phận', phuTrachBoPhan_('', 'DET'), true);
  t.bang('TAT_CA = mọi bộ phận', phuTrachBoPhan_('TAT_CA', 'SOI'), true);
  t.bang('Phụ trách DET, máy SOI', phuTrachBoPhan_('DET', 'SOI'), false);
  t.bang('Phụ trách nhiều bộ phận', phuTrachBoPhan_('DET,SOI', 'SOI'), true);

  // --- 5. Chuẩn hoá dữ liệu --------------------------------------------------
  t.bang('SĐT mất số 0 đầu được bù lại', chuanHoaSdt_(976337715), '0976337715');
  t.bang('SĐT có dấu chấm/cách', chuanHoaSdt_('0976.337.715'), '0976337715');
  t.bang('Gộp phụ tùng',
    gopPhuTung_([{ ten: 'Vòng bi 6204', soLuong: 2, dvt: 'cái' }, { ten: 'Dây curoa', soLuong: 1, dvt: 'sợi' }]),
    'Vòng bi 6204 x2 cái; Dây curoa x1 sợi');
  t.bang('Phụ tùng rỗng', gopPhuTung_([]), '');
  t.bang('Phụ tùng quá 5 dòng bị cắt',
    gopPhuTung_([1, 2, 3, 4, 5, 6, 7].map(function (i) { return { ten: 'P' + i }; })).split(';').length, 5);

  // --- 6. Danh bạ thợ — thang fallback 3 nấc ---------------------------------
  const dsTho = [
    { Ma_Tho: 'TH01', Ten_Tho: 'Hảo', Chuyen_Mon: 'DIEN', Nhom_Ca: 'TO_DIEN',
      So_Dien_Thoai: '0976337715', Bo_Phan_Phu_Trach: '', Hoat_Dong: true },
    { Ma_Tho: 'TH02', Ten_Tho: 'Dũng', Chuyen_Mon: 'CO_KHI', Nhom_Ca: 'DET',
      So_Dien_Thoai: '0976337715', Bo_Phan_Phu_Trach: 'DET', Hoat_Dong: true },
  ];
  // cauHinh: {} là bắt buộc — thiếu nó getOnDutyContacts_ sẽ tự đọc sheet Cau_Hinh
  // và bộ test mất tính chất "không đụng vào dữ liệu thật".
  function goi_(luc, lichThang, nhomLoi) {
    return getOnDutyContacts_('DET', nhomLoi || 'CO_KHI', _luc_(luc), {
      dsTho: dsTho, cauHinhCa: cfg, lichTheoThang: lichThang, cauHinh: {},
    });
  }

  // Nấc 1 — ban ngày, thợ cơ khí Dệt đang trực.
  const nac1 = goi_('2026-08-03T10:00', { '08/2026': { TH01: { '03': 'ND' }, TH02: { '03': 'N' } } });
  t.bang('Nấc 1 — mức cảnh báo', nac1.mucCanhBao, MUC_CANH_BAO.BINH_THUONG);
  t.bang('Nấc 1 — chỉ thợ đúng nghề', nac1.ds.map(function (x) { return x.tenTho; }), ['Dũng']);

  // Nấc 2 — 22h, tổ cơ khí không làm đêm, chỉ còn thợ điện trực.
  const nac2 = goi_('2026-08-03T22:00', { '08/2026': { TH01: { '03': 'ND' }, TH02: { '03': 'N' } } });
  t.bang('Nấc 2 — mức cảnh báo', nac2.mucCanhBao, MUC_CANH_BAO.NGOAI_CHUYEN_MON);
  t.bang('Nấc 2 — hiện thợ điện đang trực', nac2.ds.map(function (x) { return x.tenTho; }), ['Hảo']);

  // Nấc 3 — 22h, không ai đăng ký trực ca đêm.
  const nac3 = goi_('2026-08-03T22:00', { '08/2026': { TH01: { '03': 'N' }, TH02: { '03': 'N' } } });
  t.bang('Nấc 3 — mức cảnh báo', nac3.mucCanhBao, MUC_CANH_BAO.KHONG_CO_THO);
  t.bang('Nấc 3 — danh sách rỗng', nac3.ds.length, 0);

  // Ngoại lệ — cả tháng chưa có lịch.
  const thieu = goi_('2026-08-03T10:00', {});
  t.bang('Thiếu lịch — mức cảnh báo', thieu.mucCanhBao, MUC_CANH_BAO.THIEU_LICH);
  t.bang('Thiếu lịch — hiện thợ đúng nghề', thieu.ds.map(function (x) { return x.tenTho; }), ['Dũng']);

  // Lỗi điện ban ngày → chỉ thợ điện, không lẫn thợ cơ khí.
  const dien = goi_('2026-08-03T10:00',
    { '08/2026': { TH01: { '03': 'ND' }, TH02: { '03': 'N' } } }, 'DIEN');
  t.bang('Lỗi điện — chỉ thợ điện', dien.ds.map(function (x) { return x.tenTho; }), ['Hảo']);

  // --- 7. Số khẩn cấp --------------------------------------------------------
  const chKhan = { SDT_KHAN_CAP: '0794964115' };
  function goiKhan_(luc, lichThang) {
    return getOnDutyContacts_('DET', 'CO_KHI', _luc_(luc), {
      dsTho: dsTho, cauHinhCa: cfg, lichTheoThang: lichThang, cauHinh: chKhan,
    });
  }

  // Không ai trực → vẫn phải còn đúng số khẩn cấp để gọi.
  const khanRong = goiKhan_('2026-08-03T22:00',
    { '08/2026': { TH01: { '03': 'N' }, TH02: { '03': 'N' } } });
  t.bang('Khẩn cấp — mức cảnh báo vẫn là KHONG_CO_THO',
    khanRong.mucCanhBao, MUC_CANH_BAO.KHONG_CO_THO);
  t.bang('Khẩn cấp — có đúng 1 số', khanRong.ds.length, 1);
  t.bang('Khẩn cấp — đúng số', khanRong.ds[0].soDienThoai, '0794964115');
  t.bang('Khẩn cấp — có cờ riêng', khanRong.ds[0].khanCap, true);

  // Có thợ trực → số khẩn cấp phải nằm CUỐI, không chen lên trước thợ.
  const khanNac1 = goiKhan_('2026-08-03T10:00',
    { '08/2026': { TH01: { '03': 'ND' }, TH02: { '03': 'N' } } });
  t.bang('Khẩn cấp — xếp cuối danh sách',
    khanNac1.ds.map(function (x) { return x.tenTho; }), ['Dũng', 'Số khẩn cấp']);

  // Không khai số → không có dòng thừa nào.
  t.bang('Không khai số khẩn cấp → không thêm gì',
    goi_('2026-08-03T10:00', { '08/2026': { TH01: { '03': 'ND' }, TH02: { '03': 'N' } } }).ds.length, 1);

  // --- 8. Tách KPI đáp ứng khi chồng việc ------------------------------------
  function _phieu_(o) {
    const v = new Array(HEADER_SU_CO.length).fill('');
    Object.keys(o).forEach(function (k) { v[COT[k]] = o[k]; });
    return { dong: 0, v: v };
  }

  // Kịch bản gốc: máy 1 và máy 2 cùng hỏng 9:00. Thợ nhận máy 1 lúc 9:02,
  // xong 9:30, rồi nhận máy 2 lúc 9:32.
  const viecCu = _phieu_({
    Ma_Su_Co: 'SC-1', Ma_Tho: 'TH02', Trang_Thai: TRANG_THAI.HOAN_THANH,
    Thoi_Gian_Bao: _luc_('2026-08-03T09:00'),
    Thoi_Gian_Nhan: _luc_('2026-08-03T09:02'),
    Thoi_Gian_Hoan_Thanh: _luc_('2026-08-03T09:30'),
  });
  const chong = tinhDapUng_([viecCu], 'TH02', 'SC-2',
    _luc_('2026-08-03T09:00'), _luc_('2026-08-03T09:32'));
  t.bang('Chồng việc — chờ do thợ bận', chong.cho, 30);
  t.bang('Chồng việc — đáp ứng THỰC chỉ 2 phút', chong.thuc, 2);
  t.bang('Chồng việc — tổng vẫn bằng Phut_Tiep_Nhan', chong.cho + chong.thuc, 32);

  // Thợ rảnh hoàn toàn → toàn bộ thời gian là đáp ứng thực.
  const ranh = tinhDapUng_([], 'TH02', 'SC-2',
    _luc_('2026-08-03T09:00'), _luc_('2026-08-03T09:12'));
  t.bang('Thợ rảnh — không có chờ', ranh.cho, 0);
  t.bang('Thợ rảnh — đáp ứng thực = toàn bộ', ranh.thuc, 12);

  // Việc cũ đã xong TRƯỚC khi máy này báo hỏng → không được tính là bận.
  const cuXongTruoc = _phieu_({
    Ma_Su_Co: 'SC-1', Ma_Tho: 'TH02', Trang_Thai: TRANG_THAI.HOAN_THANH,
    Thoi_Gian_Nhan: _luc_('2026-08-03T08:10'),
    Thoi_Gian_Hoan_Thanh: _luc_('2026-08-03T08:50'),
  });
  const khongDinh = tinhDapUng_([cuXongTruoc], 'TH02', 'SC-2',
    _luc_('2026-08-03T09:00'), _luc_('2026-08-03T09:32'));
  t.bang('Việc cũ xong trước khi báo → không tính bận', khongDinh.cho, 0);
  t.bang('Việc cũ xong trước khi báo → đáp ứng thực đủ 32', khongDinh.thuc, 32);

  // Đang ôm việc dở mà vẫn nhận thêm → coi như bận tới tận lúc nhận.
  const dangOm = _phieu_({
    Ma_Su_Co: 'SC-1', Ma_Tho: 'TH02', Trang_Thai: TRANG_THAI.DANG_XU_LY,
    Thoi_Gian_Nhan: _luc_('2026-08-03T08:40'),
  });
  const om = tinhDapUng_([dangOm], 'TH02', 'SC-2',
    _luc_('2026-08-03T09:00'), _luc_('2026-08-03T09:32'));
  t.bang('Đang ôm việc — đếm được chồng việc', om.chongViec, 1);
  t.bang('Đang ôm việc — toàn bộ tính là chờ', om.cho, 32);
  t.bang('Đang ôm việc — đáp ứng thực bằng 0', om.thuc, 0);

  // Việc của thợ KHÁC không được ảnh hưởng tới KPI của thợ này.
  const cuaThoKhac = _phieu_({
    Ma_Su_Co: 'SC-9', Ma_Tho: 'TH01', Trang_Thai: TRANG_THAI.HOAN_THANH,
    Thoi_Gian_Nhan: _luc_('2026-08-03T09:02'),
    Thoi_Gian_Hoan_Thanh: _luc_('2026-08-03T09:30'),
  });
  const khac = tinhDapUng_([cuaThoKhac], 'TH02', 'SC-2',
    _luc_('2026-08-03T09:00'), _luc_('2026-08-03T09:32'));
  t.bang('Việc thợ khác không tính vào', khac.cho, 0);

  // --- 9. Công việc chung ----------------------------------------------------
  t.bang('Ô Loai_Phieu trống → hiểu là phiếu sự cố',
    laCongViec_(_phieu_({ Ma_Su_Co: 'SC-1' }).v), false);
  t.bang('Loai_Phieu = CONG_VIEC',
    laCongViec_(_phieu_({ Loai_Phieu: LOAI_PHIEU.CONG_VIEC }).v), true);

  // Đây là lý do để việc chung nằm chung sheet Su_Co: thợ lắp camera 9h–11h thì
  // máy hỏng lúc 9h30 phải chờ, nhưng KHÔNG được trừ vào KPI đáp ứng của thợ.
  const lapCamera = _phieu_({
    Ma_Su_Co: 'CV-1', Ma_Tho: 'TH02', Trang_Thai: TRANG_THAI.HOAN_THANH,
    Loai_Phieu: LOAI_PHIEU.CONG_VIEC,
    Thoi_Gian_Nhan: _luc_('2026-08-03T09:00'),
    Thoi_Gian_Hoan_Thanh: _luc_('2026-08-03T11:00'),
  });
  const banViecChung = tinhDapUng_([lapCamera], 'TH02', 'SC-2',
    _luc_('2026-08-03T09:30'), _luc_('2026-08-03T11:02'));
  t.bang('Việc chung cũng tính là thợ bận', banViecChung.cho, 90);
  t.bang('Việc chung — đáp ứng thực chỉ 2 phút', banViecChung.thuc, 2);

  // --- 10. Bảo trì hằng ngày -------------------------------------------------
  t.bang('Loai_Phieu = BAO_TRI',
    laBaoTri_(_phieu_({ Loai_Phieu: LOAI_PHIEU.BAO_TRI }).v), true);
  t.bang('Ô trống vẫn là sự cố', laSuCo_(_phieu_({ Ma_Su_Co: 'SC-1' }).v), true);

  // Điểm mấu chốt: bảo trì hằng ngày KHÔNG được tính là thợ bận. Phiếu bảo trì
  // cố ý để trống Thoi_Gian_Nhan nên tinhDapUng_ phải bỏ qua hoàn toàn.
  const baoTri = _phieu_({
    Ma_Su_Co: 'BT-1', Ma_Tho: 'TH02', Trang_Thai: TRANG_THAI.HOAN_THANH,
    Loai_Phieu: LOAI_PHIEU.BAO_TRI,
    Thoi_Gian_Bao: _luc_('2026-08-03T09:10'),
    Thoi_Gian_Hoan_Thanh: _luc_('2026-08-03T09:10'),
  });
  const khongBan = tinhDapUng_([baoTri], 'TH02', 'SC-2',
    _luc_('2026-08-03T09:00'), _luc_('2026-08-03T09:32'));
  t.bang('Bảo trì không làm thợ "bận"', khongBan.cho, 0);
  t.bang('Bảo trì không che KPI đáp ứng', khongBan.thuc, 32);
  t.bang('Bảo trì không tính là chồng việc', khongBan.chongViec, 0);

  // Đếm theo ca của đúng thợ.
  const dsBT = [
    baoTri,
    _phieu_({ Ma_Su_Co: 'BT-2', Ma_Tho: 'TH02', Loai_Phieu: LOAI_PHIEU.BAO_TRI, Ngay_Ca: '2026-08-03' }),
    _phieu_({ Ma_Su_Co: 'BT-3', Ma_Tho: 'TH02', Loai_Phieu: LOAI_PHIEU.BAO_TRI, Ngay_Ca: '2026-08-04' }),
    _phieu_({ Ma_Su_Co: 'BT-4', Ma_Tho: 'TH01', Loai_Phieu: LOAI_PHIEU.BAO_TRI, Ngay_Ca: '2026-08-03' }),
    _phieu_({ Ma_Su_Co: 'BT-5', Ma_Tho: 'TH02', Loai_Phieu: LOAI_PHIEU.BAO_TRI, Ngay_Ca: '2026-08-03',
      Ten_May: 'Tra dầu trục chính', Bo_Phan: '4T-05' }),
  ];
  t.bang('Đếm bảo trì đúng thợ + đúng ngày ca',
    demBaoTriTrongCa_(dsBT, 'TH02', '2026-08-03'), 2);
  t.bang('Danh sách bảo trì — mới nhất lên đầu, không lẫn thợ/ngày khác',
    dsBaoTriTrongCa_(dsBT, 'TH02', '2026-08-03').map(function (m) { return m.maSuCo; }),
    ['BT-5', 'BT-2']);
  t.bang('Mục bảo trì rút gọn đúng trường',
    dsBaoTriTrongCa_(dsBT, 'TH02', '2026-08-03')[0].noiDung, 'Tra dầu trục chính');

  // Nội dung việc nằm ở Mo_Ta; Ten_May để trống vì không gắn máy nào.
  t.bang('Bảo trì lấy nội dung từ Mo_Ta',
    mucBaoTri_(_phieu_({ Loai_Phieu: LOAI_PHIEU.BAO_TRI, Mo_Ta: 'Tra dầu' }).v).noiDung,
    'Tra dầu');
  t.bang('Bảo trì lùi về Ten_May cho phiếu ghi trước khi đổi',
    mucBaoTri_(_phieu_({ Loai_Phieu: LOAI_PHIEU.BAO_TRI, Ten_May: 'Siết ốc' }).v).noiDung,
    'Siết ốc');

  // --- 11. Xuất báo cáo theo form Excel --------------------------------------
  t.bang('Tách phụ tùng chuẩn',
    tachPhuTung_('Vòng bi 6204 x2 cái; Dây curoa x1 sợi'),
    [{ ten: 'Vòng bi 6204', sl: '2', dvt: 'cái' }, { ten: 'Dây curoa', sl: '1', dvt: 'sợi' }]);
  t.bang('Tách phụ tùng không có ĐVT',
    tachPhuTung_('Ắc kẹp x3'), [{ ten: 'Ắc kẹp', sl: '3', dvt: '' }]);
  t.bang('Tách phụ tùng rỗng', tachPhuTung_(''), []);
  t.bang('Nhãn ca', [nhanCa_('N'), nhanCa_('D'), nhanCa_('NGOAI_GIO')], ['Ngày', 'Đêm', '']);

  const phieuXong = _phieu_({
    Ten_Tho: 'Dũng', Trang_Thai_May: 'DA_DUNG',
    Thoi_Gian_Dung_May: _luc_('2026-08-03T09:00'),
    Thoi_Gian_Nhan: _luc_('2026-08-03T09:32'),
    Thoi_Gian_Hoan_Thanh: _luc_('2026-08-03T10:00'),
    Phut_Cho_Tho_Ban: 30, Phut_Dap_Ung_Thuc: 2, So_Chong_Viec: 0,
  }).v;
  t.bang('Phút dừng máy = kết thúc − lúc máy dừng', phutDungMay_(phieuXong), 60);
  t.bang('Trạng thái đáp ứng khi có chờ', trangThaiDapUng_(phieuXong), 'CHỜ THỢ RẢNH');

  // Phiếu cũ chưa có Thoi_Gian_Dung_May → "Bắt đầu hư" lùi về giờ công nhân báo,
  // cột này không được để trống.
  const phieuCu = _phieu_({
    Trang_Thai_May: 'DA_DUNG',
    Thoi_Gian_Bao: _luc_('2026-08-03T09:10'),
    Thoi_Gian_Hoan_Thanh: _luc_('2026-08-03T10:00'),
  }).v;
  t.bang('Bắt đầu hư lùi về giờ báo', gioCuaMoc_(mocBatDauHu_(phieuCu)), '09:10');
  t.bang('Downtime tính từ giờ báo khi thiếu mốc dừng', phutDungMay_(phieuCu), 50);

  // Máy còn chạy → có giờ bắt đầu hư nhưng KHÔNG tính downtime.
  const conChay = _phieu_({
    Trang_Thai_May: 'DANG_CHAY',
    Thoi_Gian_Bao: _luc_('2026-08-03T09:10'),
    Thoi_Gian_Hoan_Thanh: _luc_('2026-08-03T10:00'),
  }).v;
  t.bang('Máy còn chạy vẫn có giờ bắt đầu hư', gioCuaMoc_(mocBatDauHu_(conChay)), '09:10');
  t.bang('Máy còn chạy → downtime để trống', phutDungMay_(conChay), '');

  t.bang('Nhận diện bộ phận Dệt',
    [laBoPhanDet_('DET'), laBoPhanDet_('Dệt'), laBoPhanDet_('dệt'), laBoPhanDet_('SOI')],
    [true, true, true, false]);

  const chuaAiNhan = _phieu_({ Ma_Su_Co: 'SC-9' }).v;
  t.bang('Chưa ai nhận', trangThaiDapUng_(chuaAiNhan), 'CHƯA NHẬP NGƯỜI XỬ LÝ');
  t.bang('Không rõ trạng thái máy → không tính downtime', phutDungMay_(chuaAiNhan), '');

  const chongViecPhieu = _phieu_({
    Ten_Tho: 'Dũng',
    Thoi_Gian_Nhan: _luc_('2026-08-03T09:32'),
    Thoi_Gian_Hoan_Thanh: _luc_('2026-08-03T10:00'),
    So_Chong_Viec: 1,
  }).v;
  t.bang('Trạng thái khi chồng việc',
    trangThaiDapUng_(chongViecPhieu), 'CHỒNG VIỆC / KIỂM TRA DỮ LIỆU');

  // 29 cột đầu phải khớp biểu mẫu gốc; cột 30 là cột "Loại" thêm ngoài form.
  t.bang('Cột thứ 29 vẫn là cột cuối của biểu mẫu',
    HEADER_DATA_GOC[28], 'Trạng thái đáp ứng');
  t.bang('Data_Goc = 29 cột form + 1 cột Loại', HEADER_DATA_GOC.length, 30);
  t.bang('Số cột Nhật ký bảo trì đúng biểu mẫu', HEADER_NHAT_KY_DET.length, 10);

  // Việc chung và bảo trì vào Data_Goc nhưng không mang chỉ số đáp ứng.
  const viecChungPhieu = _phieu_({
    Loai_Phieu: LOAI_PHIEU.CONG_VIEC, Ten_Tho: 'Hảo',
    Thoi_Gian_Bao: _luc_('2026-08-03T09:00'),
    Thoi_Gian_Nhan: _luc_('2026-08-03T09:00'),
    Thoi_Gian_Hoan_Thanh: _luc_('2026-08-03T11:00'),
  }).v;
  t.bang('Việc chung — nhãn loại', nhanLoaiPhieu_(viecChungPhieu), 'Việc chung');
  t.bang('Việc chung — không có "bắt đầu hư"', mocBatDauHu_(viecChungPhieu), '');
  t.bang('Việc chung — trạng thái đáp ứng',
    trangThaiDapUng_(viecChungPhieu), 'KHÔNG ÁP DỤNG');
  t.bang('Việc chung — không tính downtime', phutDungMay_(viecChungPhieu), '');
  t.bang('Bảo trì — nhãn loại',
    nhanLoaiPhieu_(_phieu_({ Loai_Phieu: LOAI_PHIEU.BAO_TRI }).v), 'Bảo trì hằng ngày');

  // --- 12. Chặn spam ---------------------------------------------------------
  const bayGio = _luc_('2026-08-03T10:00').getTime();
  const dsSpam = [
    _phieu_({ Ma_May: '4T-01', Thoi_Gian_Bao: _luc_('2026-08-03T09:58') }),
    _phieu_({ Ma_May: '4T-01', Thoi_Gian_Bao: _luc_('2026-08-03T09:57') }),
    _phieu_({ Ma_May: '4T-01', Thoi_Gian_Bao: _luc_('2026-08-03T09:30') }), // ngoài cửa sổ
    _phieu_({ Ma_May: '6T-01', Thoi_Gian_Bao: _luc_('2026-08-03T09:59') }), // máy khác
  ];
  const cuaSo5Phut = bayGio - 5 * 60000;
  t.bang('Đếm phiếu trong 5 phút của đúng máy đó',
    demPhieuGanDayCuaMay_(dsSpam, '4T-01', cuaSo5Phut), 2);
  t.bang('Không tính máy khác',
    demPhieuGanDayCuaMay_(dsSpam, '6T-01', cuaSo5Phut), 1);
  t.bang('Không phân biệt hoa thường mã máy',
    demPhieuGanDayCuaMay_(dsSpam, '4t-01', cuaSo5Phut), 2);
  t.bang('Mở rộng cửa sổ thì đếm cả phiếu cũ',
    demPhieuGanDayCuaMay_(dsSpam, '4T-01', bayGio - 60 * 60000), 3);

  t.bang('Cấu hình trống → dùng mặc định', soCauHinh_('', 5), 5);
  t.bang('Cấu hình không phải số → dùng mặc định', soCauHinh_('abc', 5), 5);
  t.bang('Cấu hình 0 = tắt, phải giữ đúng 0', soCauHinh_('0', 5), 0);
  t.bang('Cấu hình hợp lệ được dùng', soCauHinh_('10', 5), 10);

  // --- 13. Bung danh mục theo dải --------------------------------------------
  const bung = bungDanhMuc_(DANH_MUC_MTX);
  t.bang('Tổng số máy MTX', bung.length, 64);
  t.bang('Mã đầu tiên', [bung[0].ma, bung[0].ten], ['1K01', 'Máy 1 kim 01']);
  t.bang('Mã cuối dải 1 kim', bung[44].ma, '1K45');
  t.bang('Bắt đầu dải Kansai', [bung[45].ma, bung[45].ten], ['KS01', 'Máy Kansai 01']);
  t.bang('Mã cuối cùng',
    [bung[63].ma, bung[63].ten], ['MCQTX02', 'Máy cắt quai túi xách 02']);
  t.bang('Không có mã nào trùng nhau',
    Object.keys(bung.reduce(function (m, x) { m[x.ma] = 1; return m; }, {})).length, 64);
  t.bang('Số luôn có 2 chữ số', bung[4].ma, '1K05');

  // --- 14. Dừng máy không do hư hỏng -----------------------------------------
  t.bang('Nhận diện phiếu dừng máy',
    laDungMay_(_phieu_({ Loai_Phieu: LOAI_PHIEU.DUNG_MAY }).v), true);
  t.bang('Phiếu dừng máy KHÔNG bị tính là sự cố',
    laSuCo_(_phieu_({ Loai_Phieu: LOAI_PHIEU.DUNG_MAY }).v), false);
  t.bang('Nhãn loại phiếu dừng máy',
    nhanLoaiPhieu_(_phieu_({ Loai_Phieu: LOAI_PHIEU.DUNG_MAY }).v), 'Dừng máy (không hư)');

  // Khác việc chung và bảo trì: phiếu dừng máy PHẢI tính được downtime.
  const dungMay = _phieu_({
    Loai_Phieu: LOAI_PHIEU.DUNG_MAY, Trang_Thai_May: 'DA_DUNG',
    Thoi_Gian_Dung_May: _luc_('2026-08-03T09:00'),
    Thoi_Gian_Hoan_Thanh: _luc_('2026-08-03T09:45'),
  }).v;
  t.bang('Dừng máy có mốc bắt đầu', gioCuaMoc_(mocBatDauHu_(dungMay)), '09:00');
  t.bang('Dừng máy tính được downtime', phutDungMay_(dungMay), 45);

  // Phiếu dừng máy không có thợ nên không được ảnh hưởng KPI đáp ứng của ai.
  const dungMayCuaTho = _phieu_({
    Loai_Phieu: LOAI_PHIEU.DUNG_MAY, Ma_Tho: '',
    Thoi_Gian_Dung_May: _luc_('2026-08-03T09:00'),
    Thoi_Gian_Hoan_Thanh: _luc_('2026-08-03T09:45'),
  });
  t.bang('Dừng máy không làm thợ "bận"',
    tinhDapUng_([dungMayCuaTho], 'TH02', 'SC-9',
      _luc_('2026-08-03T09:10'), _luc_('2026-08-03T09:40')).cho, 0);

  // Tổng phút dừng: phiếu chưa đóng vẫn phải được tính tới hiện tại.
  t.bang('Tổng phút dừng của phiếu đã đóng', tongPhutDung_([dungMay]), 45);
  t.bang('Phiếu chưa có mốc dừng thì bỏ qua',
    tongPhutDung_([_phieu_({ Loai_Phieu: LOAI_PHIEU.DUNG_MAY }).v]), 0);

  // --- 15. Gom nhóm lý do dừng máy gõ tự do ----------------------------------
  t.bang('Lấy phần lý do trước dấu gạch',
    lyDoHienThi_('Thiếu chỉ — chờ kho cấp'), 'Thiếu chỉ');
  t.bang('Không có ghi chú thêm', lyDoHienThi_('Mất điện'), 'Mất điện');
  t.bang('Bỏ trống thì báo rõ', lyDoHienThi_(''), '(không ghi lý do)');

  // Gõ khác nhau nhưng cùng nghĩa phải rơi vào một nhóm, nếu không bảng báo cáo
  // vỡ thành hàng chục dòng trùng ý.
  t.bang('Chuẩn hoá — khác hoa thường',
    chuanHoaLyDo_('Thiếu chỉ') === chuanHoaLyDo_('thiếu chỉ'), true);
  t.bang('Chuẩn hoá — mất dấu',
    chuanHoaLyDo_('Thiếu chỉ') === chuanHoaLyDo_('thieu chi'), true);
  t.bang('Chuẩn hoá — thừa khoảng trắng',
    chuanHoaLyDo_('Thiếu   chỉ') === chuanHoaLyDo_('Thiếu chỉ'), true);
  t.bang('Chuẩn hoá — chữ đ',
    chuanHoaLyDo_('Đợi kho') === chuanHoaLyDo_('doi kho'), true);
  t.bang('Lý do khác nhau vẫn tách nhóm',
    chuanHoaLyDo_('Thiếu chỉ') === chuanHoaLyDo_('Mất điện'), false);

  // --- 16. Thợ phụ trách nhiều bộ phận ---------------------------------------
  // Bộ phận nào chạy khác giờ thì khai thành BỘ PHẬN RIÊNG trong Ca_Lam_Viec,
  // không thêm cột giờ ca cho từng máy. Thợ nào lo nhiều bộ phận thì liệt kê
  // cách nhau dấu phẩy ở Bo_Phan_Phu_Trach.
  t.bang('Nhân M phụ trách cả MTX lẫn CMTD',
    [phuTrachBoPhan_('MTX,CMTD', 'CMTD'), phuTrachBoPhan_('MTX,CMTD', 'MTX'),
     phuTrachBoPhan_('MTX,CMTD', 'DET')], [true, true, false]);
  t.bang('Khoảng trắng quanh dấu phẩy không làm hỏng',
    phuTrachBoPhan_(' MTX , CMTD ', 'CMTD'), true);

  // --- 17. Xuất báo cáo theo khoảng ngày / bộ phận / thợ ----------------------
  t.bang('Ngày của phiếu lấy từ Ngay_Ca',
    ngayCuaPhieu_(_phieu_({ Ngay_Ca: '2026-08-10' }).v), '2026-08-10');
  t.bang('Thiếu Ngay_Ca thì lùi về giờ báo',
    ngayCuaPhieu_(_phieu_({ Thoi_Gian_Bao: _luc_('2026-08-10T23:30') }).v), '2026-08-10');
  t.bang('Không có mốc nào thì trả rỗng', ngayCuaPhieu_(_phieu_({}).v), '');

  const kyDs = [
    _phieu_({ Ma_Su_Co: 'SC-1', Ngay_Ca: '2026-08-09', Bo_Phan: 'MTX', Ten_Tho: 'Nhân M' }).v,
    _phieu_({ Ma_Su_Co: 'SC-2', Ngay_Ca: '2026-08-10', Bo_Phan: 'MTX', Ten_Tho: 'Nhân M' }).v,
    _phieu_({ Ma_Su_Co: 'SC-3', Ngay_Ca: '2026-08-14', Bo_Phan: 'MTX', Ten_Tho: 'Thiện' }).v,
    _phieu_({ Ma_Su_Co: 'SC-4', Ngay_Ca: '2026-08-15', Bo_Phan: 'MTX', Ten_Tho: 'Nhân M' }).v,
    _phieu_({ Ma_Su_Co: 'SC-5', Ngay_Ca: '2026-08-12', Bo_Phan: 'DET', Ten_Tho: 'Hảo' }).v,
    _phieu_({ Ma_Su_Co: 'DM-1', Ngay_Ca: '2026-08-12', Bo_Phan: 'MTX',
      Loai_Phieu: LOAI_PHIEU.DUNG_MAY }).v,
    _phieu_({ Ma_Su_Co: 'CV-1', Ngay_Ca: '2026-08-12', Bo_Phan: 'MTX',
      Loai_Phieu: LOAI_PHIEU.CONG_VIEC, Ten_Tho: 'Nhân M' }).v,
    _phieu_({ Ma_Su_Co: 'BT-1', Ngay_Ca: '2026-08-12', Bo_Phan: 'MTX',
      Loai_Phieu: LOAI_PHIEU.BAO_TRI, Ten_Tho: 'Nhân M' }).v,
  ];
  function _ma_(ds) { return ds.map(function (v) { return v[COT.Ma_Su_Co]; }); }

  // Mặc định: chỉ phiếu gắn với máy, hai đầu khoảng ngày đều LẤY.
  t.bang('Lọc kỳ 10–14/08, mặc định bỏ CV/BT',
    _ma_(locPhieuTheoKy_(kyDs, { tuNgay: '2026-08-10', denNgay: '2026-08-14' })),
    ['SC-2', 'SC-3', 'SC-5', 'DM-1']);
  t.bang('Kèm việc chung và bảo trì',
    _ma_(locPhieuTheoKy_(kyDs, { tuNgay: '2026-08-10', denNgay: '2026-08-14',
      kemViecChung: true })),
    ['SC-2', 'SC-3', 'SC-5', 'DM-1', 'CV-1', 'BT-1']);
  t.bang('Lọc bộ phận MTX bỏ được phiếu Dệt',
    _ma_(locPhieuTheoKy_(kyDs, { tuNgay: '2026-08-10', denNgay: '2026-08-14',
      dsBoPhan: ['MTX'] })),
    ['SC-2', 'SC-3', 'DM-1']);
  t.bang('Lọc bộ phận không phân biệt hoa thường',
    _ma_(locPhieuTheoKy_(kyDs, { tuNgay: '2026-08-10', denNgay: '2026-08-14',
      dsBoPhan: [' mtx '] })),
    ['SC-2', 'SC-3', 'DM-1']);
  // Lọc thợ thì phiếu dừng máy biến mất — nó không gắn thợ nào. Đây là hành vi
  // cố ý, hộp thoại có cảnh báo, và test này canh để không ai "sửa" nhầm.
  t.bang('Lọc thợ loại luôn phiếu dừng máy',
    _ma_(locPhieuTheoKy_(kyDs, { tuNgay: '2026-08-10', denNgay: '2026-08-14',
      dsTho: ['Nhân M'] })),
    ['SC-2']);
  t.bang('Danh sách lọc rỗng = không lọc',
    locPhieuTheoKy_(kyDs, { tuNgay: '2026-08-01', denNgay: '2026-08-31',
      dsBoPhan: [], dsTho: [''], kemViecChung: true }).length, 8);

  // Cắt downtime theo ngày thật (cách B): phiếu tháo motor mở 10/08 09:00, lắp
  // xong 13/08 15:00 → mỗi ngày chỉ được tính phần của ngày đó.
  const motor = _phieu_({
    Ma_Su_Co: 'SC-M', Trang_Thai_May: 'DA_DUNG',
    Thoi_Gian_Dung_May: _luc_('2026-08-10T09:00'),
    Thoi_Gian_Hoan_Thanh: _luc_('2026-08-13T15:00'),
  }).v;
  const kMotor = khoangDungMay_(motor, _luc_('2026-08-20T00:00'));
  t.bang('Ngày mở phiếu tính từ lúc dừng tới nửa đêm',
    phutDungTrongNgay_(kMotor, '2026-08-10'), 900);
  t.bang('Ngày giữa tính trọn 1440 phút',
    phutDungTrongNgay_(kMotor, '2026-08-11'), 1440);
  t.bang('Ngày đóng phiếu chỉ tính tới lúc máy chạy lại',
    phutDungTrongNgay_(kMotor, '2026-08-13'), 900);
  t.bang('Ngày ngoài khoảng dừng = 0',
    phutDungTrongNgay_(kMotor, '2026-08-14'), 0);
  t.bang('Không ngày nào vượt quá một ngày thật',
    ['2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13'].every(function (n) {
      return phutDungTrongNgay_(kMotor, n) <= 1440;
    }), true);
  t.bang('Cộng đủ 4 ngày bằng tổng thời gian dừng',
    ['2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13']
      .reduce(function (s, n) { return s + phutDungTrongNgay_(kMotor, n); }, 0),
    900 + 1440 + 1440 + 900);

  // Phiếu chưa đóng: đồng hồ chạy tới "bây giờ", và phải đánh dấu còn đang dừng.
  const conDung = _phieu_({
    Trang_Thai_May: 'DA_DUNG', Thoi_Gian_Dung_May: _luc_('2026-08-14T08:00'),
  }).v;
  const kConDung = khoangDungMay_(conDung, _luc_('2026-08-14T11:30'));
  t.bang('Phiếu chưa đóng vẫn tính downtime',
    phutDungTrongNgay_(kConDung, '2026-08-14'), 210);
  t.bang('Phiếu chưa đóng được đánh dấu còn đang dừng', kConDung.dangDung, true);
  t.bang('Máy còn chạy thì không có khoảng dừng',
    khoangDungMay_(_phieu_({ Trang_Thai_May: 'DANG_CHAY',
      Thoi_Gian_Bao: _luc_('2026-08-14T08:00') }).v, _luc_('2026-08-14T11:30')), null);
  t.bang('Việc chung không có khoảng dừng',
    khoangDungMay_(_phieu_({ Loai_Phieu: LOAI_PHIEU.CONG_VIEC,
      Trang_Thai_May: 'DA_DUNG',
      Thoi_Gian_Bao: _luc_('2026-08-14T08:00') }).v, _luc_('2026-08-14T11:30')), null);
  t.bang('Không có khoảng thì phút bằng 0', phutDungTrongNgay_(null, '2026-08-14'), 0);

  // Dải ngày và nhãn
  t.bang('Dải ngày lấy cả hai đầu',
    dsNgayTrongKy_('2026-08-10', '2026-08-13'),
    ['2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13']);
  t.bang('Một ngày duy nhất', dsNgayTrongKy_('2026-08-10', '2026-08-10').length, 1);
  t.bang('Đến trước từ thì rỗng', dsNgayTrongKy_('2026-08-10', '2026-08-09'), []);
  t.bang('Dải ngày vắt qua tháng',
    dsNgayTrongKy_('2026-07-31', '2026-08-01'), ['2026-07-31', '2026-08-01']);
  t.bang('Thứ trong tuần',
    [thuCuaNgay_('2026-08-10'), thuCuaNgay_('2026-08-16')], ['T2', 'CN']);

  t.bang('Cuối tháng 8', khoangCuaThang_('08/2026'),
    { tu: '2026-08-01', den: '2026-08-31' });
  t.bang('Tháng 2 năm thường', khoangCuaThang_('02/2026').den, '2026-02-28');
  t.bang('Tháng 2 năm nhuận', khoangCuaThang_('02/2028').den, '2028-02-29');

  t.bang('Trọn tháng thì nhãn gọn lại',
    nhanKy_('2026-08-01', '2026-08-31'), 'Tháng 08/2026');
  t.bang('Khoảng lẻ hiện đủ hai đầu',
    nhanKy_('2026-08-10', '2026-08-14'), '10/08/2026 – 14/08/2026');
  t.bang('Tên file trọn tháng giữ nguyên như cũ',
    tenFileXuat_('2026-08-01', '2026-08-31', [], []), 'BaoCao_HuHong_T08_2026');
  t.bang('Tên file khoảng lẻ có lọc',
    tenFileXuat_('2026-08-10', '2026-08-14', ['MTX'], ['Nhân M']),
    'BaoCao_HuHong_2026-08-10_den_2026-08-14_MTX_NhânM');

  // Bảng thống kê chỉ liệt kê máy/thợ liên quan, không đổ cả danh mục ra.
  const mayGia = [
    { Ma_May: 'M1', Ten_May: 'Máy 1 kim 01', Bo_Phan: 'MTX' },
    { Ma_May: 'M2', Ten_May: 'Máy dệt 01', Bo_Phan: 'DET' },
  ];
  t.bang('Lọc máy theo bộ phận',
    locMayTheoBoPhan_(mayGia, { dsBoPhan: ['MTX'] }).map(function (m) { return m.Ma_May; }),
    ['M1']);
  t.bang('Không lọc thì giữ cả danh mục',
    locMayTheoBoPhan_(mayGia, { dsBoPhan: [] }).length, 2);

  const thoGia = [
    { Ten_Tho: 'Nhân M', Bo_Phan_Phu_Trach: 'MTX,CMTD' },
    { Ten_Tho: 'Hảo', Bo_Phan_Phu_Trach: 'DET' },
    { Ten_Tho: '', Bo_Phan_Phu_Trach: 'MTX' },
  ];
  t.bang('Thợ không tên bị loại khỏi bảng',
    locThoTheoCtx_(thoGia, {}).length, 2);
  t.bang('Lọc bộ phận → chỉ thợ phụ trách bộ phận đó',
    locThoTheoCtx_(thoGia, { dsBoPhan: ['MTX'] }).map(function (x) { return x.Ten_Tho; }),
    ['Nhân M']);
  t.bang('Chọn thợ thì ưu tiên đúng người đã chọn',
    locThoTheoCtx_(thoGia, { dsBoPhan: ['MTX'], dsTho: ['Hảo'] })
      .map(function (x) { return x.Ten_Tho; }),
    ['Hảo']);

  // Gom theo ngày — nguồn chung của trang Bao_Cao và sheet Theo_Ngay. Hai nơi
  // dùng chung hàm này nên không thể ra số lệch nhau.
  const gomDs = [
    _phieu_({ Ma_Su_Co: 'SC-A', Ngay_Ca: '2026-08-10', Ten_May: 'Máy 1 kim 01',
      Ten_Tho: 'Nhân M', Trang_Thai_May: 'DA_DUNG', Phut_Xu_Ly: 40,
      Phut_Tiep_Nhan: 12, Phut_Dap_Ung_Thuc: 12,
      Thoi_Gian_Dung_May: _luc_('2026-08-10T08:00'),
      Thoi_Gian_Hoan_Thanh: _luc_('2026-08-10T09:00') }).v,
    _phieu_({ Ma_Su_Co: 'SC-B', Ngay_Ca: '2026-08-11', Ten_May: 'Máy 1 kim 01',
      Ten_Tho: 'Nhân M', Trang_Thai_May: 'DA_DUNG', Phut_Xu_Ly: 20,
      Phut_Tiep_Nhan: 8, Phut_Dap_Ung_Thuc: 8,
      Thoi_Gian_Dung_May: _luc_('2026-08-11T08:00'),
      Thoi_Gian_Hoan_Thanh: _luc_('2026-08-11T08:30') }).v,
    _phieu_({ Ma_Su_Co: 'DM-A', Ngay_Ca: '2026-08-10', Ten_May: 'Máy 1 kim 02',
      Loai_Phieu: LOAI_PHIEU.DUNG_MAY, Trang_Thai_May: 'DA_DUNG',
      Thoi_Gian_Dung_May: _luc_('2026-08-10T23:00'),
      Thoi_Gian_Hoan_Thanh: _luc_('2026-08-11T01:00') }).v,
  ];
  const gomKq = gomTheoNgay_(gomDs, { tuNgay: '2026-08-10', denNgay: '2026-08-11' },
    _luc_('2026-08-20T00:00'));

  t.bang('Gom theo ngày ra đúng số dòng', gomKq.dong.length, 2);
  t.bang('Ngày 10/08 — 1 lần sửa, 1 phiếu dừng không do hư',
    [gomKq.dong[0].soSuCo, gomKq.dong[0].soDung], [1, 1]);
  // "Số lần máy phải dừng" đếm MỌI phiếu làm máy nằm im, không chỉ phiếu DM-.
  // Tách hai khái niệm vì dòng tổng từng ghi "0 lần dừng máy" ngay cạnh
  // "4,2 giờ máy nằm im" — đúng kỹ thuật nhưng đọc lên là mâu thuẫn.
  t.bang('Ngày 10/08 — 2 lần máy phải dừng (1 sự cố + 1 phiếu DM)',
    gomKq.dong[0].soPhaiDung, 2);
  const ngayConChay = gomTheoNgay_([
    _phieu_({ Ma_Su_Co: 'SC-C', Ngay_Ca: '2026-08-10', Trang_Thai_May: 'DANG_CHAY',
      Thoi_Gian_Bao: _luc_('2026-08-10T08:00'),
      Thoi_Gian_Hoan_Thanh: _luc_('2026-08-10T08:30') }).v,
  ], { tuNgay: '2026-08-10', denNgay: '2026-08-10' },
    _luc_('2026-08-20T00:00')).dong[0];

  t.bang('Sự cố không làm dừng máy thì không đếm là lần máy phải dừng',
    [ngayConChay.soSuCo, ngayConChay.soPhaiDung, ngayConChay.tongPhut], [1, 0, 0]);
  // Nhưng phiếu đó VẪN phải hiện trong nhật ký, với dòng "không dừng máy" —
  // máy vẫn hỏng và thợ vẫn mất công sửa, chỉ là dây chuyền không phải dừng.
  t.bang('Phiếu máy còn chạy vẫn nằm trong nhật ký ngày',
    [ngayConChay.phieu.length, ngayConChay.phieu[0].khoang], [1, null]);
  t.bang('Ngày 10/08 — 60 phút do hư, 60 phút nguyên nhân khác',
    [gomKq.dong[0].phutHu, gomKq.dong[0].phutKhac], [60, 60]);
  // Phiếu dừng máy vắt qua nửa đêm: 60 phút thuộc ngày 10, 60 phút thuộc ngày 11.
  t.bang('Phần sau nửa đêm rơi sang ngày hôm sau',
    [gomKq.dong[1].phutHu, gomKq.dong[1].phutKhac], [30, 60]);
  t.bang('Tổng phút của một ngày = hư + khác',
    gomKq.dong[0].tongPhut, 120);
  t.bang('Tổng cả kỳ cộng đúng',
    [gomKq.tong.soSuCo, gomKq.tong.soDung, gomKq.tong.tongPhut, gomKq.tong.phutSua],
    [2, 1, 210, 60]);
  t.bang('Quy ra giờ làm tròn 1 chữ số', [quyRaGio_(210), quyRaGio_(0)], [3.5, 0]);

  // Nhật ký từng ngày: phiếu vắt qua nửa đêm phải xuất hiện ở CẢ HAI ngày, kèm
  // chữ "còn tiếp" / "tiếp từ" — nếu không người đọc tưởng máy hỏng hai lần.
  t.bang('Ngày 10/08 có 2 phiếu, ngày 11/08 có 2 phiếu',
    [gomKq.dong[0].phieu.length, gomKq.dong[1].phieu.length], [2, 2]);
  t.bang('Phiếu DM- xuất hiện ở cả hai ngày',
    [gomKq.dong[0].phieu.some(function (p) { return p.v[COT.Ma_Su_Co] === 'DM-A'; }),
     gomKq.dong[1].phieu.some(function (p) { return p.v[COT.Ma_Su_Co] === 'DM-A'; })],
    [true, true]);
  t.bang('Sang ngày sau thì không còn tính là phiếu mở trong ngày',
    gomKq.dong[1].phieu.filter(function (p) {
      return p.v[COT.Ma_Su_Co] === 'DM-A';
    })[0].moTrongNgay, false);

  const kDM = gomKq.dong[0].phieu.filter(function (p) {
    return p.v[COT.Ma_Su_Co] === 'DM-A';
  })[0].khoang;
  t.bang('Ngày mở phiếu ghi "còn tiếp"',
    moTaGioDung_(kDM, '2026-08-10'), '23:00 → còn tiếp');
  t.bang('Ngày sau ghi "tiếp từ"',
    moTaGioDung_(kDM, '2026-08-11'), '→ 01:00 (tiếp từ 10/08)');
  t.bang('Phiếu gọn trong ngày ghi đủ hai đầu giờ',
    moTaGioDung_(khoangDungMay_(gomDs[0], _luc_('2026-08-20T00:00')), '2026-08-10'),
    '08:00–09:00');
  t.bang('Phiếu vắt trọn một ngày',
    moTaGioDung_({ tu: _luc_('2026-08-10T09:00'), den: _luc_('2026-08-13T15:00'),
      dangDung: false }, '2026-08-11'), 'cả ngày (tiếp từ 10/08)');
  t.bang('Máy chưa chạy lại được nói rõ',
    moTaGioDung_({ tu: _luc_('2026-08-10T08:00'), den: _luc_('2026-08-10T11:00'),
      dangDung: true }, '2026-08-10'), '08:00–11:00 (chưa chạy lại)');
  t.bang('Không có khoảng dừng', moTaGioDung_(null, '2026-08-10'), 'không dừng máy');
  t.bang('Tiêu đề ngày có thứ',
    tieuDeNgay_('2026-08-10'), 'THỨ HAI, 10/08/2026');
  t.bang('Đáp ứng trung bình của ngày',
    [trungBinh_(gomKq.dong[0].dapUng), trungBinh_(gomKq.dong[1].dapUng)], [12, 8]);

  // Chỉ đích danh phiếu gây ra chờ. Đây là thứ làm con số "chờ do thợ bận" kiểm
  // chứng được — trước đó hệ thống tự trừ thời gian mà không nói vì phiếu nào.
  const banDs = [
    _phieu_({ Ma_Su_Co: 'SC-CU', Ma_Tho: 'TH02', Ten_Tho: 'Nhân M',
      Ngay_Ca: '2026-08-10',
      Thoi_Gian_Bao: _luc_('2026-08-10T08:00'),
      Thoi_Gian_Nhan: _luc_('2026-08-10T08:05'),
      Thoi_Gian_Hoan_Thanh: _luc_('2026-08-10T09:15') }).v,
    _phieu_({ Ma_Su_Co: 'SC-MOI', Ma_Tho: 'TH02', Ten_Tho: 'Nhân M',
      Ngay_Ca: '2026-08-10',
      Thoi_Gian_Bao: _luc_('2026-08-10T09:00'),
      Thoi_Gian_Nhan: _luc_('2026-08-10T09:24'),
      Phut_Tiep_Nhan: 24, Phut_Cho_Tho_Ban: 15, Phut_Dap_Ung_Thuc: 9,
      So_Chong_Viec: 0 }).v,
    _phieu_({ Ma_Su_Co: 'SC-KHAC', Ma_Tho: 'TH09', Ten_Tho: 'Hảo',
      Ngay_Ca: '2026-08-10',
      Thoi_Gian_Bao: _luc_('2026-08-10T08:00'),
      Thoi_Gian_Nhan: _luc_('2026-08-10T08:10'),
      Thoi_Gian_Hoan_Thanh: _luc_('2026-08-10T09:20') }).v,
  ];
  t.bang('Tìm đúng phiếu khiến máy phải chờ',
    timPhieuGayBan_(banDs[1], banDs).ma, 'SC-CU');
  t.bang('Không lấy nhầm phiếu của thợ khác',
    timPhieuGayBan_(banDs[1], [banDs[1], banDs[2]]), null);
  t.bang('Phiếu không phải chờ thì không có nguồn gây bận',
    timPhieuGayBan_(banDs[0], banDs), null);

  // Chồng việc = 0 nhưng vẫn bị trừ 15 phút — đúng ca người dùng thắc mắc.
  const pBan = { v: banDs[1], khoang: null, phut: 0, moTrongNgay: true };
  t.bang('Ghi chú nói rõ chờ vì phiếu nào',
    ghiChuDong_(pBan, '2026-08-10', { ma: 'SC-CU' }),
    'máy vẫn chạy · chờ 15 phút do thợ đang làm SC-CU');
  t.bang('Việc gây bận nằm ngoài phạm vi lọc thì nói rõ',
    ghiChuDong_(pBan, '2026-08-10', null),
    'máy vẫn chạy · chờ 15 phút do thợ bận việc ngoài phạm vi báo cáo này');
  t.bang('Phiếu tiếp từ hôm trước không ghi lại lý do chờ',
    ghiChuDong_({ v: banDs[1], khoang: null, phut: 0, moTrongNgay: false },
      '2026-08-11', { ma: 'SC-CU' }),
    'tiếp từ 10/08 · máy vẫn chạy');

  // Mốc giờ khác ngày phải kèm ngày, nếu không đọc nhầm là báo hư hôm nay.
  t.bang('Mốc trong ngày chỉ hiện giờ',
    mocTrongNgay_(_luc_('2026-08-10T14:00'), '2026-08-10'), '14:00');
  t.bang('Mốc khác ngày kèm ngày',
    mocTrongNgay_(_luc_('2026-08-10T14:00'), '2026-08-11'), '10/08 14:00');
  t.bang('Không có mốc thì gạch ngang', mocTrongNgay_('', '2026-08-10'), '—');

  const gomBan = gomTheoNgay_(banDs, { tuNgay: '2026-08-10', denNgay: '2026-08-10' },
    _luc_('2026-08-20T00:00'));
  t.bang('Đếm số phiếu phải chờ vì thợ bận trong ngày',
    gomBan.dong[0].soChoBan, 1);
  t.bang('Chờ + sau khi rảnh = đáp ứng',
    Number(banDs[1][COT.Phut_Cho_Tho_Ban]) + Number(banDs[1][COT.Phut_Dap_Ung_Thuc]),
    Number(banDs[1][COT.Phut_Tiep_Nhan]));

  const thoBan = gomTheoMayTho_(banDs).theoTho['Nhân M'];
  t.bang('Thợ — 1 phiếu phải chờ, tổng 15 phút, 0 lần chồng việc',
    [thoBan.soChoBan, thoBan.tongCho, thoBan.chong], [1, 15, 0]);

  const gomMT = gomTheoMayTho_(gomDs);
  t.bang('Gom theo máy chỉ đếm sự cố, bỏ phiếu dừng máy',
    Object.keys(gomMT.theoMay), ['Máy 1 kim 01']);
  t.bang('Máy hỏng 2 lần, tổng downtime 90 phút',
    [gomMT.theoMay['Máy 1 kim 01'].lan, gomMT.theoMay['Máy 1 kim 01'].downtime],
    [2, 90]);
  t.bang('Đếm theo loại phiếu',
    [gomMT.tong.soSuCo, gomMT.tong.soDungMay], [2, 1]);
  t.bang('Thợ — tổng phút sửa và tổng phút máy dừng',
    [gomMT.theoTho['Nhân M'].tongSua, gomMT.theoTho['Nhân M'].tongDung], [60, 90]);
  t.bang('Phiếu dừng máy không tạo dòng thợ nào',
    Object.keys(gomMT.theoTho), ['Nhân M']);

  t.bang('Nhật ký Dệt chỉ lấy sự cố, bỏ dừng máy',
    _ma_(locSuCoDet_([
      _phieu_({ Ma_Su_Co: 'SC-D', Bo_Phan: 'DET' }).v,
      _phieu_({ Ma_Su_Co: 'DM-D', Bo_Phan: 'DET', Loai_Phieu: LOAI_PHIEU.DUNG_MAY }).v,
      _phieu_({ Ma_Su_Co: 'SC-X', Bo_Phan: 'MTX' }).v,
    ])),
    ['SC-D']);

  // --- 18. Báo cáo trong ngày: gom sự cố theo bộ phận ------------------------
  // Thứ tự bộ phận theo LÚC XUẤT HIỆN, không theo bảng chữ cái và không ưu tiên
  // bộ phận nào. Trong mỗi bộ phận vẫn theo giờ.
  const dsGom = [
    { ma: 'SC-3', boPhan: 'MTX', tsBao: _luc_('2026-08-10T09:00').getTime() },
    { ma: 'SC-1', boPhan: 'DET', tsBao: _luc_('2026-08-10T07:30').getTime() },
    { ma: 'SC-4', boPhan: 'MTX', tsBao: _luc_('2026-08-10T08:15').getTime() },
    { ma: 'SC-2', boPhan: 'DET', tsBao: _luc_('2026-08-10T10:00').getTime() },
    { ma: 'SC-5', boPhan: 'SOI', tsBao: _luc_('2026-08-10T07:45').getTime() },
  ];
  t.bang('Gom theo bộ phận, bộ phận xuất hiện sớm nhất đứng trước',
    sapTheoBoPhanRoiGio_(dsGom).map(function (x) { return x.ma; }),
    ['SC-1', 'SC-2', 'SC-5', 'SC-4', 'SC-3']);
  t.bang('Bộ phận trống vẫn có chỗ đứng',
    nhomBoPhan_({ boPhan: '  ' }), '(không rõ bộ phận)');

  // Ca đêm vắt qua nửa đêm: phiếu 01:00 sáng thuộc Ngay_Ca hôm trước nên phải
  // nằm SAU phiếu 22:00 cùng ca. So chuỗi 'HH:mm' sẽ đẩy nó lên đầu ngày.
  t.bang('Ca đêm không bị nhảy lên đầu',
    sapTheoBoPhanRoiGio_([
      { ma: 'DEM', boPhan: 'DET', tsBao: _luc_('2026-08-11T01:00').getTime() },
      { ma: 'TOI', boPhan: 'DET', tsBao: _luc_('2026-08-10T22:00').getTime() },
    ]).map(function (x) { return x.ma; }),
    ['TOI', 'DEM']);

  // --- 18. Bù phiếu dừng máy -------------------------------------------------
  t.bang('Đọc mốc yyyy-MM-dd HH:mm',
    mocTuChuoi_('2026-08-18 17:27').getTime(), _luc_('2026-08-18T17:27').getTime());
  t.bang('Chấp nhận cả dấu T ngăn cách',
    mocTuChuoi_('2026-08-18T17:27').getTime(), _luc_('2026-08-18T17:27').getTime());
  t.bang('Sai định dạng thì trả null',
    [mocTuChuoi_('18/08/2026 17:27'), mocTuChuoi_('2026-08-18'),
     mocTuChuoi_('2026-8-18 7:5'), mocTuChuoi_('')],
    [null, null, null, null]);

  // Ca thật của tời nâng số 1: phiếu sự cố đóng 18/08 17:27, tới 20/08 08:52 mới
  // ráp xong — 39 giờ 25 phút máy đứng không phiếu nào phủ.
  t.bang('Khoảng bù của tời nâng ra đúng số phút',
    Math.round((mocTuChuoi_('2026-08-20 08:52').getTime() -
                mocTuChuoi_('2026-08-18 17:27').getTime()) / 60000), 2365);

  // --- Kết quả ---------------------------------------------------------------
  const tong = kq.dat + kq.loi.length;
  const bao = kq.loi.length
    ? '❌ ' + kq.loi.length + '/' + tong + ' test HỎNG\n\n' + kq.loi.join('\n\n')
    : '✅ Tất cả ' + tong + ' test đều đạt.';

  console.log(bao);
  return bao;
}

function menuChayTest() { chayVaBao_('Test logic', chayTest); }
