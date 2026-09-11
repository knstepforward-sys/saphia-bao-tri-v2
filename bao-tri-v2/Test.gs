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

  // Mốc chốt ngày ca — biên mà báo cáo ngày ngừng cộng dồn phiếu chưa đóng.
  // MAC_DINH vào ca 07:00 nên ngày 03/08 chốt lúc 07:00 ngày 04/08.
  t.bang('Ngày đã qua chốt ở giờ vào ca hôm sau',
    fmtGio_(mocChotNgayCa_('2026-08-03', cfg)), '07:00');
  t.bang('Mốc chốt rơi đúng vào ngày hôm sau',
    fmtNgay_(mocChotNgayCa_('2026-08-03', cfg)), '2026-08-04');
  // Ngày hôm nay: biên còn ở tương lai nên phải trả về giờ hiện tại, không được
  // chốt sớm — máy đang dừng thật thì phút dừng vẫn phải chạy.
  t.bang('Ngày hôm nay chưa chốt, lấy giờ hiện tại',
    mocChotNgayCa_(fmtNgay_(nowVN_()), cfg) <= nowVN_()
      && fmtNgay_(mocChotNgayCa_(fmtNgay_(nowVN_()), cfg)) === fmtNgay_(nowVN_()), true);
  t.bang('Ngày rỗng/sai định dạng → giờ hiện tại, không văng lỗi',
    fmtNgay_(mocChotNgayCa_('', cfg)), fmtNgay_(nowVN_()));

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

  // --- 8b. KPI đáp ứng bản cộng dồn đoạn bận ---------------------------------
  // Ca then chốt, bộ test cũ KHÔNG phủ: thợ bận thành HAI đoạn rời. Cách cũ lấy
  // mốc rảnh muộn nhất nên nuốt luôn khoảng rảnh xen giữa; cách mới cộng dồn.
  const banDoan1 = _phieu_({
    Ma_Su_Co: 'SC-A', Ma_Tho: 'TH02', Trang_Thai: TRANG_THAI.HOAN_THANH,
    Thoi_Gian_Nhan: _luc_('2026-08-03T08:50'),
    Thoi_Gian_Hoan_Thanh: _luc_('2026-08-03T09:10'),
  });
  const banDoan2 = _phieu_({
    Ma_Su_Co: 'SC-B', Ma_Tho: 'TH02', Trang_Thai: TRANG_THAI.HOAN_THANH,
    Thoi_Gian_Nhan: _luc_('2026-08-03T09:30'),
    Thoi_Gian_Hoan_Thanh: _luc_('2026-08-03T09:50'),
  });
  const haiDoan = [banDoan1, banDoan2];
  const bao10 = _luc_('2026-08-03T09:00');
  const nhan10 = _luc_('2026-08-03T10:00');

  const roi = phutBanTrongCho_(haiDoan, 'TH02', 'SC-2', bao10, nhan10);
  t.bang('Hai đoạn bận rời — bận thực tế 10 + 20', roi.phutBan, 30);
  t.bang('Hai đoạn bận rời — đếm đúng 2 đoạn', roi.soDoan, 2);

  // Cùng dữ liệu, cách cũ chỉ tính thợ 10 phút — chênh 20 phút rảnh xen giữa.
  const cachCu = tinhDapUng_(haiDoan, 'TH02', 'SC-2', bao10, nhan10);
  t.bang('Cách cũ miễn trừ rộng hơn — đây là lý do phải vá', cachCu.thuc, 10);

  const phieuRoi = _phieu_({
    Ma_Su_Co: 'SC-2', Ma_Tho: 'TH02', Thoi_Gian_Bao: bao10, Thoi_Gian_Nhan: nhan10,
  }).v;
  const kRoi = kpiThoChoPhieu_(haiDoan, phieuRoi, 0);
  t.bang('Hai đoạn bận rời — KPI thợ 30 phút', kRoi.phutKpi, 30);
  t.bang('Đáp ứng = bận thực tế + KPI thợ', kRoi.phutBan + kRoi.phutKpi, 60);

  // Ca một đoạn bận TRÙM QUA lúc máy này báo hỏng: hai cách phải ra ĐÚNG cùng
  // con số, nếu không là đã lặng lẽ đổi nghĩa toàn bộ dữ liệu cũ.
  const phieuMotDoan = _phieu_({
    Ma_Su_Co: 'SC-2', Ma_Tho: 'TH02',
    Thoi_Gian_Bao: _luc_('2026-08-03T09:00'), Thoi_Gian_Nhan: _luc_('2026-08-03T09:32'),
  }).v;
  const banTrum = _phieu_({
    Ma_Su_Co: 'SC-1', Ma_Tho: 'TH02', Trang_Thai: TRANG_THAI.HOAN_THANH,
    Thoi_Gian_Nhan: _luc_('2026-08-03T08:50'),
    Thoi_Gian_Hoan_Thanh: _luc_('2026-08-03T09:30'),
  });
  const kTrum = kpiThoChoPhieu_([banTrum], phieuMotDoan, 0);
  t.bang('Một đoạn bận trùm đầu — KPI khớp y hệt cách cũ',
    kTrum.phutKpi,
    tinhDapUng_([banTrum], 'TH02', 'SC-2',
      _luc_('2026-08-03T09:00'), _luc_('2026-08-03T09:32')).thuc);
  t.bang('Một đoạn bận trùm đầu — chỉ 1 đoạn', kTrum.soDoan, 1);

  // Nhưng nếu thợ nhận việc cũ SAU lúc máy này báo hỏng thì hai cách lệch nhau:
  // `viecCu` được nhận lúc 09:02, máy này báo 09:00 — hai phút 09:00–09:02 thợ
  // chưa cầm việc nào cả. Cách cũ gộp luôn vào "bận" (KPI 2 phút), cách mới trả
  // hai phút đó về cho thợ (KPI 4 phút). Cách mới đúng: máy đã nằm chờ trong khi
  // thợ còn rảnh. Đây là chỗ thứ hai mà cách cũ rộng tay, ngoài ca nhiều đoạn.
  const kSauBao = kpiThoChoPhieu_([viecCu], phieuMotDoan, 0);
  t.bang('Nhận việc cũ sau lúc báo — cách cũ chỉ tính thợ 2 phút', chong.thuc, 2);
  t.bang('Nhận việc cũ sau lúc báo — cách mới tính đủ 4 phút', kSauBao.phutKpi, 4);

  // Thợ rảnh hẳn → không có đoạn nào, KPI bằng trọn thời gian chờ.
  const kRanh = kpiThoChoPhieu_([], phieuMotDoan, 0);
  t.bang('Thợ rảnh — không đoạn bận nào', kRanh.soDoan, 0);
  t.bang('Thợ rảnh — KPI bằng cả 32 phút', kRanh.phutKpi, 32);

  // Đang ôm việc dở lúc nhận → bận suốt cửa sổ → KPI bằng 0.
  const kOm = kpiThoChoPhieu_([dangOm], phieuMotDoan, 0);
  t.bang('Đang ôm việc dở — KPI bằng 0', kOm.phutKpi, 0);

  // Việc chung tính là bận; bảo trì thì không — giữ đúng như cách cũ.
  // Khai riêng phiếu ở đây, KHÔNG dùng lại `lapCamera` của mục 9: nó khai bằng
  // const ở phía dưới, gọi lên trên là dính "Cannot access before initialization".
  const camera8b = _phieu_({
    Ma_Su_Co: 'CV-8B', Ma_Tho: 'TH02', Trang_Thai: TRANG_THAI.HOAN_THANH,
    Loai_Phieu: LOAI_PHIEU.CONG_VIEC,
    Thoi_Gian_Nhan: _luc_('2026-08-03T09:00'),
    Thoi_Gian_Hoan_Thanh: _luc_('2026-08-03T11:00'),
  });
  t.bang('Việc chung vẫn miễn trừ cho thợ',
    phutBanTrongCho_([camera8b], 'TH02', 'SC-2',
      _luc_('2026-08-03T09:30'), _luc_('2026-08-03T11:02')).phutBan, 90);

  const baoTri8b = _phieu_({
    Ma_Su_Co: 'BT-8B', Ma_Tho: 'TH02', Trang_Thai: TRANG_THAI.HOAN_THANH,
    Loai_Phieu: LOAI_PHIEU.BAO_TRI,
    Thoi_Gian_Hoan_Thanh: _luc_('2026-08-03T09:10'),
  });
  t.bang('Bảo trì vẫn không làm thợ "bận"',
    phutBanTrongCho_([baoTri8b], 'TH02', 'SC-2', bao10, nhan10).phutBan, 0);

  // Tính lúc nhận (phiếu kia còn mở) và tính lại sau này (phiếu kia đã đóng muộn
  // hơn) phải cho CÙNG kết quả — nếu lệch thì backfill sẽ viết đè số sai lên số
  // đã ghi tại chỗ.
  const conMo = _phieu_({
    Ma_Su_Co: 'SC-B', Ma_Tho: 'TH02', Trang_Thai: TRANG_THAI.DANG_XU_LY,
    Thoi_Gian_Nhan: _luc_('2026-08-03T09:30'),
  });
  const dongMuon = _phieu_({
    Ma_Su_Co: 'SC-B', Ma_Tho: 'TH02', Trang_Thai: TRANG_THAI.HOAN_THANH,
    Thoi_Gian_Nhan: _luc_('2026-08-03T09:30'),
    Thoi_Gian_Hoan_Thanh: _luc_('2026-08-03T10:20'),
  });
  t.bang('Tính lúc nhận và tính lại sau cho cùng số phút',
    [phutBanTrongCho_([banDoan1, conMo], 'TH02', 'SC-2', bao10, nhan10).phutBan,
      phutBanTrongCho_([banDoan1, dongMuon], 'TH02', 'SC-2', bao10, nhan10).phutBan],
    [40, 40]);

  // Phiếu nào bị loại khỏi KPI, và vì sao.
  t.bang('Việc chung không vào KPI',
    kpiThoChoPhieu_([], _phieu_({ Ma_Su_Co: 'CV-1', Ma_Tho: 'TH02',
      Loai_Phieu: LOAI_PHIEU.CONG_VIEC }).v, 0).apDung, 'KHONG — phiếu CONG_VIEC');
  t.bang('Bảo trì không vào KPI',
    kpiThoChoPhieu_([], _phieu_({ Ma_Su_Co: 'BT-1', Ma_Tho: 'TH02',
      Loai_Phieu: LOAI_PHIEU.BAO_TRI }).v, 0).apDung, 'KHONG — phiếu BAO_TRI');
  t.bang('Phiếu chưa ai nhận không vào KPI',
    kpiThoChoPhieu_([], _phieu_({ Ma_Su_Co: 'SC-3' }).v, 0).apDung,
    'KHONG — chưa ai nhận');
  t.bang('Thiếu mốc giờ thì không chấm',
    kpiThoChoPhieu_([], _phieu_({ Ma_Su_Co: 'SC-3', Ma_Tho: 'TH02',
      Thoi_Gian_Bao: bao10 }).v, 0).apDung, 'KHONG — thiếu mốc giờ');
  t.bang('Phiếu bị loại thì để trống ô phút, không ghi 0',
    kpiThoChoPhieu_([], _phieu_({ Ma_Su_Co: 'SC-3' }).v, 0).phutKpi, '');

  // Ngưỡng: để trống thì không chấm đạt/không đạt.
  t.bang('Chưa chốt ngưỡng — không chấm đạt', kRoi.datNguong, '');
  t.bang('KPI 30 phút, ngưỡng 30 → ĐẠT',
    kpiThoChoPhieu_(haiDoan, phieuRoi, 30).datNguong, 'DAT');
  t.bang('KPI 30 phút, ngưỡng 15 → KHÔNG ĐẠT',
    kpiThoChoPhieu_(haiDoan, phieuRoi, 15).datNguong, 'KHONG_DAT');

  // Phân vị dùng thứ hạng gần nhất — luôn trả về một giá trị có thật.
  t.bang('Phân vị — trung vị của 5 số', phanVi_([2, 4, 6, 8, 10], 0.5), 6);
  t.bang('Phân vị — P90 lấy số lớn nhất trong 5 số', phanVi_([2, 4, 6, 8, 10], 0.9), 10);
  t.bang('Phân vị — mảng rỗng trả rỗng', phanVi_([], 0.5), '');
  t.bang('Tỷ lệ — mẫu 0 trả rỗng chứ không phải 0%', tyLe_(0, 0), '');
  t.bang('Tỷ lệ — 3/4 thành 75', tyLe_(3, 4), 75);

  // --- 8c. Trang Tom_Tat — kỳ liền trước và mức tăng giảm --------------------
  // Sai biên ngày ở đây là so nhầm kỳ mà bảng vẫn hiện ra đẹp đẽ, không ai thấy.
  t.bang('Lùi 1 ngày qua đầu tháng', dichNgay_('2026-08-01', -1), '2026-07-31');
  t.bang('Lùi 1 ngày vào tháng 2 (2026 không nhuận)',
    dichNgay_('2026-03-01', -1), '2026-02-28');
  t.bang('Tiến 1 ngày qua cuối năm', dichNgay_('2026-12-31', 1), '2027-01-01');
  t.bang('Ngày hỏng thì trả rỗng', dichNgay_('linh tinh', -1), '');

  // Kỳ tháng 8 (31 ngày) → kỳ trước phải là trọn tháng 7, không phải 30 ngày.
  const soNgayT8 = dsNgayTrongKy_('2026-08-01', '2026-08-31').length;
  const denT7 = dichNgay_('2026-08-01', -1);
  t.bang('Kỳ trước của tháng 8 là trọn tháng 7',
    [dichNgay_(denT7, -(soNgayT8 - 1)), denT7], ['2026-07-01', '2026-07-31']);

  // Hướng tốt/xấu: downtime giảm là tốt, tỷ lệ đạt tăng mới là tốt.
  t.bang('Giờ dừng giảm → tốt', soSanhKy_(50, 62, true, ' giờ').tot, true);
  t.bang('Giờ dừng tăng → xấu', soSanhKy_(70, 62, true, ' giờ').tot, false);
  t.bang('Tỷ lệ đạt tăng → tốt', soSanhKy_(80, 71, false, '%').tot, true);
  t.bang('Kỳ trước trống thì không kết luận',
    soSanhKy_(50, '', true, ' giờ'), { chu: 'kỳ trước chưa có số liệu', tot: null });
  t.bang('Không đổi thì không tô màu',
    soSanhKy_(50, 50, true, ' giờ'), { chu: 'không đổi so với kỳ trước', tot: null });
  t.bang('Có nêu rõ tăng hay giảm bao nhiêu',
    soSanhKy_(50, 62, true, ' giờ').chu, '▼ giảm 12 giờ so với kỳ trước');

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

  // 29 cột đầu phải khớp biểu mẫu gốc; các cột sau đó là phần thêm ngoài form —
  // 30 "Loại", rồi 31–32 là hai cột KPI (09/2026). Test này canh đúng chỗ đó:
  // cột thứ 29 mà xê dịch là biểu mẫu gửi sếp đã lệch.
  t.bang('Cột thứ 29 vẫn là cột cuối của biểu mẫu',
    HEADER_DATA_GOC[28], 'Trạng thái đáp ứng');
  t.bang('Data_Goc = 29 cột form + Loại + 2 cột KPI', HEADER_DATA_GOC.length, 32);
  t.bang('Hai cột thêm sau cùng là KPI',
    [HEADER_DATA_GOC[30], HEADER_DATA_GOC[31]], ['KPI thợ\n(Phút)', 'Số đoạn bận']);
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

  // --- 14b. Gọi kỹ thuật lúc máy đang dừng (phiếu HT-) -----------------------
  // Loại phiếu này sinh ra để giữ đúng hai con số: "số lần máy hỏng" không được
  // phồng lên vì đổi mặt hàng, và "phút máy dừng" không được đếm hai lần.
  const hoTro = _phieu_({
    Loai_Phieu: LOAI_PHIEU.HO_TRO, Trang_Thai_May: 'DA_DUNG',
    Nhom_Loi: 'CO_KHI', Ma_Tho: 'TH02',
    Thoi_Gian_Bao: _luc_('2026-08-03T09:00'),
    Thoi_Gian_Nhan: _luc_('2026-08-03T09:12'),
    Thoi_Gian_Hoan_Thanh: _luc_('2026-08-03T09:45'),
  }).v;

  t.bang('Nhận diện phiếu gọi kỹ thuật', laHoTro_(hoTro), true);
  t.bang('Gọi kỹ thuật KHÔNG bị tính là sự cố', laSuCo_(hoTro), false);
  t.bang('Ô Loai_Phieu lạ vẫn rơi về SU_CO, không rơi nhầm sang HO_TRO',
    loaiPhieu_(_phieu_({ Loai_Phieu: 'LOAI_LA' }).v), LOAI_PHIEU.SU_CO);
  t.bang('Nhãn loại phiếu gọi kỹ thuật',
    nhanLoaiPhieu_(hoTro), 'Gọi kỹ thuật (máy đang dừng)');

  // Hai phép chặn downtime. Phiếu DM- mở song song mới là phiếu đo khoảng dừng;
  // nếu một trong hai hàm dưới đây trả về số thì phút máy nằm im bị cộng hai lần.
  t.bang('Gọi kỹ thuật không có mốc "máy hư"', mocBatDauHu_(hoTro), '');
  t.bang('Gọi kỹ thuật không tính downtime', phutDungMay_(hoTro), '');
  t.bang('Gọi kỹ thuật không sinh khoảng dừng ở tỉ lệ hiệu dụng',
    khoangDungCuaPhieu_(hoTro, _luc_('2026-08-03T10:00')), null);
  t.bang('Dù Trang_Thai_May vẫn ghi DA_DUNG',
    String(hoTro[COT.Trang_Thai_May]), 'DA_DUNG');

  // Nhưng VẪN đo đáp ứng và VẪN là việc của thợ — chủ dự án chốt tính chung một
  // con số với sự cố, 11/09/2026.
  t.bang('Gọi kỹ thuật CÓ vào KPI đáp ứng',
    kpiThoChoPhieu_([], hoTro, 0).apDung, 'CO');
  t.bang('Dừng máy thì KHÔNG vào KPI',
    kpiThoChoPhieu_([], _phieu_({ Ma_Su_Co: 'DM-1', Ma_Tho: 'TH02',
      Loai_Phieu: LOAI_PHIEU.DUNG_MAY }).v, 0).apDung, 'KHONG — phiếu DUNG_MAY');
  t.bang('Trạng thái đáp ứng không còn là KHÔNG ÁP DỤNG',
    trangThaiDapUng_(_phieu_({ Loai_Phieu: LOAI_PHIEU.HO_TRO, Ten_Tho: 'Nhân',
      Thoi_Gian_Nhan: _luc_('2026-08-03T09:12'),
      Thoi_Gian_Hoan_Thanh: _luc_('2026-08-03T09:45') }).v), 'THỢ RẢNH');
  t.bang('Vào trung bình đáp ứng chung với sự cố',
    tbDapUngSuCo_([_phieu_({ Loai_Phieu: LOAI_PHIEU.HO_TRO,
      Phut_Tiep_Nhan: 12 }).v]), 12);

  // Nhánh đếm theo loại phiếu kết thúc bằng "còn lại là bảo trì". Thiếu một
  // nhánh riêng là phiếu HT- bị đếm thành bảo trì mà không có lỗi nào để thấy.
  const gomHT = gomTheoMayTho_([hoTro]);
  t.bang('Không bị đếm nhầm thành bảo trì', gomHT.tong.soBaoTri, 0);
  t.bang('Được đếm riêng', gomHT.tong.soHoTro, 1);
  t.bang('Không cộng vào số lần hỏng', gomHT.tong.soSuCo, 0);

  // Mô tả nối hai phiếu với nhau bằng mã DM-, không thêm cột mới vào Su_Co.
  t.bang('Mô tả gom đủ lý do dừng, ghi chú và mã phiếu dừng',
    ghepMoTaHoTro_({ maSuCo: 'DM-0308-002', moTa: 'Đổi mặt hàng' }, 'chỉnh lại cữ'),
    'Gọi kỹ thuật — máy đang dừng — Đổi mặt hàng — chỉnh lại cữ — phiếu DM-0308-002');
  t.bang('Không gõ gì thêm thì bỏ luôn phần đó',
    ghepMoTaHoTro_({ maSuCo: 'DM-0308-002', moTa: 'Đổi mặt hàng' }, ''),
    'Gọi kỹ thuật — máy đang dừng — Đổi mặt hàng — phiếu DM-0308-002');
  t.bang('Phiếu dừng không ghi lý do vẫn ra câu đọc được',
    ghepMoTaHoTro_({ maSuCo: 'DM-0308-002', moTa: '' }, ''),
    'Gọi kỹ thuật — máy đang dừng — phiếu DM-0308-002');

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

  // --- 19. Tỉ lệ hiệu dụng A -------------------------------------------------
  t.bang('Chuẩn hoá khoá bỏ dấu và đ',
    [chuanKhoa_('CMTĐ'), chuanKhoa_('Chung'), chuanKhoa_(' Máy  kéo sợi ')],
    ['CMTD', 'CHUNG', 'MAY KEO SOI']);
  t.bang('Ô tick đọc được cả chữ lẫn boolean',
    [batCauHinh_(true), batCauHinh_('TRUE'), batCauHinh_('false'),
     batCauHinh_('', true), batCauHinh_('', false)],
    [true, true, false, true, false]);
  t.bang('Ngày nghỉ nhận cả hai định dạng',
    docNgayNghi_('02/09/2026, 2026-09-03'),
    { '2026-09-02': true, '2026-09-03': true });

  // Kế hoạch giả: bộ phận TEST chạy 07:00–17:00 (600 phút), T2–T7, chủ nhật nghỉ.
  const khGia = {
    TEST: {
      ten: 'TEST', tu: 420, den: 1020, caDem: false,
      thu: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 0: false },
      nghi: {},
    },
  };
  const mayHD = [{ Ma_May: 'M1', Ten_May: 'Máy thử 1', Bo_Phan: 'TEST', Hoat_Dong: true }];
  const ctGia = { suCo: true, dungMay: true, congViec: false };

  t.bang('Ngày thường ra đúng một khung 600 phút',
    tongPhutKhoang_(khungKeHoachNgay_(khGia.TEST, '2026-08-10')), 600);
  t.bang('Chủ nhật không có khung nào',
    khungKeHoachNgay_(khGia.TEST, '2026-08-16').length, 0);
  t.bang('Bộ phận có ca đêm chạy trọn 24 giờ',
    tongPhutKhoang_(khungKeHoachNgay_(
      { tu: 420, den: 1020, caDem: true, thu: { 1: true }, nghi: {} }, '2026-08-10')), 1440);
  t.bang('Ngày nghỉ lễ bị loại khỏi kế hoạch',
    khungKeHoachNgay_(
      { tu: 420, den: 1020, caDem: false, thu: { 1: true }, nghi: { '2026-08-10': true } },
      '2026-08-10').length, 0);

  const khCoNghi = {
    tu: 420, den: 1020, caDem: false, thu: { 1: true }, nghi: {},
    tamDung: [{ loai: 'NGHI_TRUA', tu: 690, den: 750, thu: null }],
  };
  t.bang('Nghỉ trưa bị loại khỏi kế hoạch',
    tongPhutKhoang_(khungKeHoachNgay_(khCoNghi, '2026-08-10')), 540);
  t.bang('Nghỉ trưa tách ca thành hai khung chạy',
    khungKeHoachNgay_(khCoNghi, '2026-08-10').map(function (x) {
      return [fmtGio_(x.tu), fmtGio_(x.den)];
    }), [['07:00', '11:30'], ['12:30', '17:00']]);

  const khCoGiaoCa = {
    tu: 420, den: 1020, caDem: true, thu: { 1: true }, nghi: {},
    tamDung: [
      { loai: 'GIAO_CA', tu: 1020, den: 1035, thu: null },
      { loai: 'GIAO_CA', tu: 410, den: 420, thu: null },
    ],
  };
  t.bang('Ca 24 giờ trừ cả giao ca ngày-đêm và đêm-ngày',
    tongPhutKhoang_(khungKeHoachNgay_(khCoGiaoCa, '2026-08-10')), 1415);

  // Đại số khoảng — nền của mọi con số phía trên.
  t.bang('Hai khoảng rời nhau thì không giao',
    giaoKhoang_({ tu: _luc_('2026-08-10T08:00'), den: _luc_('2026-08-10T09:00') },
                { tu: _luc_('2026-08-10T10:00'), den: _luc_('2026-08-10T11:00') }), null);
  t.bang('Khoảng chồng nhau gộp làm một, không cộng hai lần',
    tongPhutKhoang_(gomKhoang_([
      { tu: _luc_('2026-08-10T08:00'), den: _luc_('2026-08-10T10:00') },
      { tu: _luc_('2026-08-10T09:00'), den: _luc_('2026-08-10T11:00') },
    ])), 180);
  t.bang('Trừ một khoảng giữa tách thành hai phần',
    truKhoang_([
      { tu: _luc_('2026-08-10T07:00'), den: _luc_('2026-08-10T17:00') },
    ], [
      { tu: _luc_('2026-08-10T11:30'), den: _luc_('2026-08-10T12:30') },
    ]).map(function (x) { return [fmtGio_(x.tu), fmtGio_(x.den)]; }),
    [['07:00', '11:30'], ['12:30', '17:00']]);

  // Sự cố mà máy VẪN CHẠY không được trừ vào A.
  t.bang('Sự cố máy còn chạy không sinh khoảng dừng',
    khoangDungCuaPhieu_(_phieu_({
      Trang_Thai_May: 'DANG_CHAY',
      Thoi_Gian_Bao: _luc_('2026-08-10T08:00'),
      Thoi_Gian_Hoan_Thanh: _luc_('2026-08-10T09:00'),
    }).v, _luc_('2026-08-10T12:00')), null);

  function _hd_(dsPhieu, bayGio) {
    return tinhHieuDung_('2026-08-10', '2026-08-16', {
      bayGio: bayGio || _luc_('2026-08-17T00:00'),
      keHoach: khGia, congTac: ctGia, dsMay: mayHD, dsPhieu: dsPhieu,
    });
  }

  // 10–15/08 là T2–T7, 16/08 chủ nhật nghỉ → 6 ngày × 600 phút.
  t.bang('Kế hoạch tuần bỏ chủ nhật', _hd_([]).tong.phutKeHoach, 3600);
  t.bang('Không phiếu nào thì A = 100%', _hd_([]).tong.tiLe, 1);

  const khNghiGia = {
    TEST: {
      ten: 'TEST', tu: 420, den: 1020, caDem: false,
      thu: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 0: false },
      nghi: {}, tamDung: [{ loai: 'NGHI_TRUA', tu: 690, den: 750, thu: null }],
    },
  };
  function _hdNghi_(tu, den) {
    return tinhHieuDung_('2026-08-10', '2026-08-10', {
      bayGio: _luc_('2026-08-11T00:00'), keHoach: khNghiGia,
      congTac: ctGia, dsMay: mayHD,
      dsPhieu: [_phieu_({
        Ma_Su_Co: 'SC-N', Ma_May: 'M1', Trang_Thai_May: 'DA_DUNG',
        Thoi_Gian_Dung_May: _luc_(tu), Thoi_Gian_Hoan_Thanh: _luc_(den),
      }).v],
    });
  }
  t.bang('Dừng hoàn toàn trong giờ nghỉ trưa không làm giảm A',
    _hdNghi_('2026-08-10T11:30', '2026-08-10T12:30').may[0].phutDung, 0);
  t.bang('Dừng xuyên nghỉ trưa chỉ trừ phần thuộc giờ chạy',
    _hdNghi_('2026-08-10T11:00', '2026-08-10T13:00').may[0].phutDung, 60);

  // Ca thật của tời nâng: máy đứng từ 17:27 hôm trước tới 08:52 hai hôm sau —
  // 39 giờ 25 đồng hồ, nhưng chỉ 712 phút rơi vào giờ kế hoạch (cả ngày 11/08
  // là 600, sáng 12/08 từ 07:00 tới 08:52 là 112; 17:27 ngày 10/08 đã ngoài ca).
  const toiNang = _phieu_({
    Ma_Su_Co: 'DM-1', Ma_May: 'M1', Loai_Phieu: LOAI_PHIEU.DUNG_MAY,
    Thoi_Gian_Dung_May: _luc_('2026-08-10T17:27'),
    Thoi_Gian_Hoan_Thanh: _luc_('2026-08-12T08:52'),
  }).v;
  t.bang('Dừng 39 giờ chỉ ăn đúng phần giờ kế hoạch',
    _hd_([toiNang]).may[0].phutDung, 712);
  t.bang('A không bao giờ âm dù dừng vắt nhiều ngày',
    Math.round(_hd_([toiNang]).tong.tiLe * 10000) / 10000,
    Math.round((3600 - 712) / 3600 * 10000) / 10000);

  // Phiếu sự cố và phiếu dừng máy chồng nhau của cùng một máy — đúng quy trình
  // đem đồ ra ngoài gia công. Cộng riêng từng phiếu là đếm downtime hai lần.
  const scChong = _phieu_({
    Ma_Su_Co: 'SC-1', Ma_May: 'M1', Trang_Thai_May: 'DA_DUNG',
    Thoi_Gian_Dung_May: _luc_('2026-08-10T08:00'),
    Thoi_Gian_Hoan_Thanh: _luc_('2026-08-10T10:00'),
  }).v;
  const dmChong = _phieu_({
    Ma_Su_Co: 'DM-2', Ma_May: 'M1', Loai_Phieu: LOAI_PHIEU.DUNG_MAY,
    Thoi_Gian_Dung_May: _luc_('2026-08-10T09:00'),
    Thoi_Gian_Hoan_Thanh: _luc_('2026-08-10T11:00'),
  }).v;
  t.bang('Phiếu chồng nhau chỉ tính một lần',
    _hd_([scChong, dmChong]).may[0].phutDung, 180);

  // Máy đứng nguyên chủ nhật vẫn không mất giờ nào: hôm đó không có kế hoạch.
  t.bang('Dừng đúng ngày nghỉ không trừ vào A',
    _hd_([_phieu_({
      Ma_Su_Co: 'DM-3', Ma_May: 'M1', Loai_Phieu: LOAI_PHIEU.DUNG_MAY,
      Thoi_Gian_Dung_May: _luc_('2026-08-16T00:00'),
      Thoi_Gian_Hoan_Thanh: _luc_('2026-08-16T23:59'),
    }).v]).may[0].phutDung, 0);

  // Giữa kỳ thì kế hoạch chỉ tính tới lúc chạy báo cáo — lấy cả tuần thì sáng
  // thứ Ba máy nào cũng trông như vừa đứng bốn ngày.
  t.bang('Kế hoạch cắt tại thời điểm chạy báo cáo',
    _hd_([], _luc_('2026-08-11T12:00')).tong.phutKeHoach, 900);

  // Việc chung đang TẮT trong ctGia nên không được trừ, dù phiếu ghi đúng máy.
  const cvPhieu = _phieu_({
    Ma_Su_Co: 'CV-1', Ten_May: 'Máy thử 1', Loai_Phieu: LOAI_PHIEU.CONG_VIEC,
    Thoi_Gian_Nhan: _luc_('2026-08-10T08:00'),
    Thoi_Gian_Hoan_Thanh: _luc_('2026-08-10T10:00'),
  }).v;
  t.bang('Việc chung tắt thì không trừ', _hd_([cvPhieu]).may[0].phutDung, 0);
  t.bang('Việc chung bật thì dò ngược theo tên máy',
    tinhHieuDung_('2026-08-10', '2026-08-16', {
      bayGio: _luc_('2026-08-17T00:00'), keHoach: khGia, dsMay: mayHD,
      congTac: { suCo: true, dungMay: true, congViec: true }, dsPhieu: [cvPhieu],
    }).may[0].phutDung, 120);

  // Bộ phận chưa khai kế hoạch: A phải là null, KHÔNG phải 0 — chưa đo được và
  // đứng cả tuần là hai chuyện khác hẳn nhau.
  const kqThieu = tinhHieuDung_('2026-08-10', '2026-08-16', {
    bayGio: _luc_('2026-08-17T00:00'), keHoach: {}, congTac: ctGia,
    dsMay: mayHD, dsPhieu: [],
  });
  t.bang('Chưa khai kế hoạch thì A là null, không phải 0', kqThieu.may[0].tiLe, null);
  t.bang('Và bộ phận đó được nêu tên để đi khai', kqThieu.thieuKeHoach, ['TEST']);

  // --- 20. Thông báo Telegram ------------------------------------------------
  //
  // ⚠️ Phần lớn các ca dưới đây là bản SAO của `kiemtra/thongbao.js`. Sửa kỳ vọng
  // ở một bên mà quên bên kia thì bộ chạy tại máy vẫn xanh trong khi bộ này đỏ —
  // đã dính đúng một lần ngày 03/09/2026 với `kpi-tho.js`. Sửa ca nào thì sửa CẢ
  // HAI chỗ rồi chạy lại cả hai.
  //
  // Phần CHỈ có ở đây, không chép được sang bộ tại máy, là nhóm ca cuối: thay hàm
  // gửi và hàm đọc sheet bằng hàm giả để chạy thử hai hàm ghép. Bộ tại máy không
  // làm được vì `lienLacTho_` đọc `Danh_Muc_Tho`.

  const _phieuTg_ = function (o) {
    const v = new Array(HEADER_SU_CO.length).fill('');
    Object.keys(o).forEach(function (k) { v[COT[k]] = o[k]; });
    return v;
  };
  const _mauTg_ = {
    Ma_Su_Co: 'SC-0909-014', Ma_May: 'DET12', Ten_May: 'MÁY DỆT 12', Bo_Phan: 'DET',
    Nhom_Loi: 'Lỗi cơ khí', Mo_Ta: 'Máy kêu to rồi dừng đột ngột',
    Thoi_Gian_Bao: _luc_('2026-09-09T14:32'),
    Ten_Tho: 'Nhân', Thoi_Gian_Nhan: _luc_('2026-09-09T14:35'),
  };
  const _LINK_ = 'https://x.io/baotri.html?tho=TH01&token=abc';

  // Việt Nam không có giờ mùa hè nên +07:00 là hằng số, không phải xấp xỉ.
  t.bang('gioVN_ đổi đúng mốc UTC sang giờ Việt Nam',
    gioVN_(new Date('2026-09-09T07:32:00Z')), '14:32');
  t.bang('gioVN_ vắt qua nửa đêm', gioVN_(new Date('2026-09-09T18:30:00Z')), '01:30');
  t.bang('gioVN_ với ô trống trả rỗng', gioVN_(''), '');
  // In ra số phút âm là người đọc mất tin tưởng vào cả cái bot.
  t.bang('phutGiua_ giờ ngược nhau trả 0',
    phutGiua_(_luc_('2026-09-09T15:00'), _luc_('2026-09-09T14:00')), 0);

  t.bang('Tin sự cố đầy đủ khớp nguyên văn mẫu mục 4.3',
    soanTinSuCoMoi_(_phieuTg_(_mauTg_), _LINK_),
    '🔴 MÁY DỆT 12 (DET) đã dừng\n' +
    'Lỗi cơ khí\n' +
    '"Máy kêu to rồi dừng đột ngột"\n' +
    'Báo lúc 14:32 · phiếu SC-0909-014\n' +
    '\n' +
    '➡️ Bấm để nhận việc: ' + _LINK_);
  // Phiếu DM- không có nhóm lỗi. In ra dòng trắng là tin trông như lỗi hiển thị.
  t.bang('Thiếu nhóm lỗi thì rụng đúng dòng đó',
    soanTinSuCoMoi_(_phieuTg_({ Ten_May: 'MÁY SOI 4', Bo_Phan: 'SOI',
      Ma_Su_Co: 'DM-0909-003', Thoi_Gian_Bao: _luc_('2026-09-09T08:00') }), ''),
    '🔴 MÁY SOI 4 (SOI) đã dừng\nBáo lúc 08:00 · phiếu DM-0909-003');
  // Tin là văn bản trơn, cố ý không dùng parse_mode.
  t.bang('Ký tự đặc biệt trong mô tả giữ nguyên văn',
    soanTinSuCoMoi_(_phieuTg_({ Ten_May: 'M', Mo_Ta: 'Kêu <to> *gấp* _cần_ sửa' }), '')
      .indexOf('"Kêu <to> *gấp* _cần_ sửa"') > 0, true);

  t.bang('Tin đã nhận khớp nguyên văn mẫu mục 4.3',
    soanTinDaNhan_(_phieuTg_(_mauTg_)),
    '✅ Nhân đã nhận SC-0909-014 lúc 14:35. Bạn không cần xử lý.');

  const _nhac1_ = soanTinNhac_(_phieuTg_(_mauTg_), 1, _luc_('2026-09-09T14:52'),
    _LINK_, '0912345678');
  const _nhac2_ = soanTinNhac_(_phieuTg_(_mauTg_), 2, _luc_('2026-09-09T15:12'),
    _LINK_, '0912345678');
  t.bang('Nhắc lần 1 nêu số phút máy nằm im',
    _nhac1_.indexOf('Máy đã nằm im 20 phút.') > 0, true);
  // Lớp 3 ở mục 4.4: số khẩn cấp chỉ xuất hiện ở lần nhắc thứ hai. Đưa ra sớm là
  // mất hết sức nặng của nó.
  t.bang('Nhắc lần 1 KHÔNG kèm số khẩn cấp', _nhac1_.indexOf('0912345678') < 0, true);
  t.bang('Nhắc lần 2 kèm số khẩn cấp', _nhac2_.indexOf('0912345678') > 0, true);

  // Sheets đọc ô số lớn ra dạng mũ nếu người dùng dán đè định dạng. Gửi tới một
  // id đã bị làm tròn là nhắn nhầm người khác, nên thà không gửi.
  t.bang('chuanHoaChatId_ chặn dạng mũ của Sheets', chuanHoaChatId_('1.23457E+11'), '');
  t.bang('chuanHoaChatId_ nhận id âm của nhóm',
    chuanHoaChatId_('-1001234567890'), '-1001234567890');
  t.bang('catTin_ cắt tin quá dài và đánh dấu bị cắt', catTin_('abcdefgh', 5), 'abcd…');
  // 429 và 5xx hỏng phía hệ thống; 400 và 403 hỏng ở một chat id cụ thể.
  t.bang('nenBatCauChi_ bật khi bị chặn tốc độ', nenBatCauChi_([200, 429]), true);
  t.bang('nenBatCauChi_ KHÔNG bật vì một chat id sai', nenBatCauChi_([200, 400]), false);

  const _llTg_ = {
    TH01: { chatId: '111', link: 'https://x/?tho=TH01' },
    TH02: { chatId: '222', link: 'https://x/?tho=TH02' },
  };
  t.bang('Bỏ số khẩn cấp ở cuối danh bạ',
    locNguoiNhan_({ ds: [{ maTho: 'TH01' }, { maTho: '', khanCap: true }] }, _llTg_, '')
      .length, 1);
  t.bang('Bỏ chính người vừa bấm nhận',
    locNguoiNhan_({ ds: [{ maTho: 'TH01' }, { maTho: 'TH02' }] }, _llTg_, 'TH01')
      .map(function (n) { return n.maTho; }), ['TH02']);

  const _bay_ = _luc_('2026-09-09T15:00');
  const _phieuCho_ = function (ma, phutTruoc, trangThai) {
    return { dong: 1, v: _phieuTg_({ Ma_Su_Co: ma, Ma_May: 'DET12', Bo_Phan: 'DET',
      Trang_Thai: trangThai || TRANG_THAI.CHO_NHAN,
      Thoi_Gian_Bao: new Date(_bay_.getTime() - phutTruoc * 60000) }) };
  };
  const _chNhac_ = { NHAC_LAN_1_PHUT: '10', NHAC_LAN_2_PHUT: '20' };

  t.bang('Lần 2 đè lên lần 1 trong nhật ký',
    demLanDaNhac_([{ Ma_Su_Co: 'SC-1', Actor: 'BOT', Hanh_Dong: 'NHAC_LAN_1' },
      { Ma_Su_Co: 'SC-1', Actor: 'BOT', Hanh_Dong: 'NHAC_LAN_2' }]), { 'SC-1': 2 });
  t.bang('Chỉ đếm dòng của BOT, bỏ dòng của người',
    demLanDaNhac_([{ Ma_Su_Co: 'SC-1', Actor: 'TH01', Hanh_Dong: 'NHAN_VIEC' }]), {});
  t.bang('Quá ngưỡng 1 thì nhắc lần 1',
    chonPhieuCanNhac_([_phieuCho_('SC-1', 12)], {}, _chNhac_, _bay_)
      .map(function (m) { return m.lan; }), [1]);
  // Rào 5.11: hai lần là hết, đời đời.
  t.bang('Đã nhắc lần 2 thì thôi hẳn',
    chonPhieuCanNhac_([_phieuCho_('SC-1', 300)], { 'SC-1': 2 }, _chNhac_, _bay_), []);
  // Trigger chạy trễ: nhắc "lần 1" cho phiếu đã treo 3 tiếng là nói sai sự thật.
  t.bang('Quá cả hai ngưỡng ngay lần xét đầu thì nhảy thẳng lên lần 2',
    chonPhieuCanNhac_([_phieuCho_('SC-1', 90)], {}, _chNhac_, _bay_)
      .map(function (m) { return m.lan; }), [2]);
  t.bang('Phiếu đã có thợ nhận thì không nhắc',
    chonPhieuCanNhac_([_phieuCho_('SC-1', 60, TRANG_THAI.DANG_XU_LY)], {}, _chNhac_, _bay_), []);
  // Rào chặn lúc gõ BAT lần đầu: không có nó thì công tắc vừa bật là bot bắn một
  // loạt tin về những phiếu cũ còn treo từ trước.
  t.bang('Phiếu treo quá một ngày thì thôi',
    chonPhieuCanNhac_([_phieuCho_('SC-1', 1500)], {}, _chNhac_, _bay_), []);

  // --- 20b. Hai hàm ghép, chạy với hàm gửi GIẢ -------------------------------
  //
  // Nhóm ca duy nhất không chép sang `kiemtra/thongbao.js` được, vì `lienLacTho_`
  // đọc `Danh_Muc_Tho` và `thongBaoDaNhan_` gọi `getOnDutyContacts_`.
  //
  // Thay hàm bằng cách gán đè rồi TRẢ LẠI trong `finally`. Quên trả lại là mọi
  // test chạy sau đó dùng nhầm hàm giả — nguy hiểm hơn hẳn một test đỏ, vì nó
  // xanh mà sai.

  const _gocGui_ = guiTelegram_;
  const _gocLienLac_ = lienLacTho_;
  const _gocDanhBa_ = getOnDutyContacts_;
  let _daGui_ = [];

  try {
    guiTelegram_ = function (ds) { _daGui_ = ds || []; return _daGui_.length; };
    lienLacTho_ = function () { return _llTg_; };

    // Mỗi thợ phải nhận LINK CỦA CHÍNH MÌNH. Gửi nhầm link của người khác là thợ
    // A bấm nhận rồi hệ thống ghi tên thợ B.
    _daGui_ = [];
    const _so1_ = thongBaoSuCoMoi_(_phieuTg_(_mauTg_),
      { ds: [{ maTho: 'TH01' }, { maTho: 'TH02' }] }, { TELEGRAM_BAT: 'BAT' });
    t.bang('Gửi đúng 2 tin cho 2 thợ', _so1_, 2);
    t.bang('Đúng chat id của từng người',
      _daGui_.map(function (x) { return x.chatId; }), ['111', '222']);
    t.bang('Mỗi thợ nhận link riêng của mình',
      _daGui_.map(function (x) { return x.text.indexOf('?tho=TH0') > 0; }), [true, true]);
    t.bang('Thợ TH02 nhận đúng link TH02',
      _daGui_[1].text.indexOf('https://x/?tho=TH02') > 0, true);

    // Rào 5.4: ghép chat id cho 15 thợ làm dần, ai chưa có thì im lặng bỏ qua.
    _daGui_ = [];
    t.bang('Thợ chưa ghép chat id thì bỏ qua, không lỗi',
      thongBaoSuCoMoi_(_phieuTg_(_mauTg_), { ds: [{ maTho: 'TH09' }] }, {}), 0);
    t.bang('Và không gửi tin nào cả', _daGui_.length, 0);

    // Rào 5.1: hàm gửi hỏng KHÔNG được kéo theo thứ gì khác.
    guiTelegram_ = function () { throw new Error('Telegram chết hẳn'); };
    t.bang('Hàm gửi ném lỗi thì hàm ghép vẫn trả 0, không ném ra ngoài',
      thongBaoSuCoMoi_(_phieuTg_(_mauTg_), { ds: [{ maTho: 'TH01' }] }, {}), 0);
    t.bang('Hàm đọc sheet ném lỗi cũng vậy', (function () {
      lienLacTho_ = function () { throw new Error('Sheet hỏng'); };
      return thongBaoSuCoMoi_(_phieuTg_(_mauTg_), { ds: [{ maTho: 'TH01' }] }, {});
    })(), 0);

    // Báo đã có người nhận: gửi cho những người CÒN LẠI.
    lienLacTho_ = function () { return _llTg_; };
    guiTelegram_ = function (ds) { _daGui_ = ds || []; return _daGui_.length; };
    getOnDutyContacts_ = function () { return { ds: [{ maTho: 'TH01' }, { maTho: 'TH02' }] }; };

    _daGui_ = [];
    t.bang('Báo đã nhận chỉ gửi cho người còn lại',
      thongBaoDaNhan_(_phieuTg_(_mauTg_), 'TH01', {}), 1);
    t.bang('Đúng người còn lại', _daGui_[0].chatId, '222');
    t.bang('Và đúng nội dung tin đã nhận',
      _daGui_[0].text, '✅ Nhân đã nhận SC-0909-014 lúc 14:35. Bạn không cần xử lý.');

    // Ca trực chỉ có một người: nhận xong thì không còn ai để báo.
    getOnDutyContacts_ = function () { return { ds: [{ maTho: 'TH01' }] }; };
    _daGui_ = [];
    t.bang('Ca chỉ có một thợ thì không gửi tin nào',
      thongBaoDaNhan_(_phieuTg_(_mauTg_), 'TH01', {}), 0);
    t.bang('Thật sự không gửi gì', _daGui_.length, 0);

  } finally {
    guiTelegram_ = _gocGui_;
    lienLacTho_ = _gocLienLac_;
    getOnDutyContacts_ = _gocDanhBa_;
  }

  t.bang('Đã trả lại hàm gửi thật sau khi thay', guiTelegram_ === _gocGui_, true);
  t.bang('Đã trả lại hàm đọc danh mục thợ', lienLacTho_ === _gocLienLac_, true);
  t.bang('Đã trả lại hàm dựng danh bạ', getOnDutyContacts_ === _gocDanhBa_, true);

  // --- Kết quả ---------------------------------------------------------------
  const tong = kq.dat + kq.loi.length;
  const bao = kq.loi.length
    ? '❌ ' + kq.loi.length + '/' + tong + ' test HỎNG\n\n' + kq.loi.join('\n\n')
    : '✅ Tất cả ' + tong + ' test đều đạt.';

  console.log(bao);
  return bao;
}

function menuChayTest() { chayVaBao_('Test logic', chayTest); }
