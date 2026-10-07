using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Windows.Forms;
using Autodesk.Revit.Attributes;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;

using View = Autodesk.Revit.DB.View;
using TaskDialog = Autodesk.Revit.UI.TaskDialog;
using Form = System.Windows.Forms.Form;
using Point = System.Drawing.Point;
using Color = System.Drawing.Color;
using Font = System.Drawing.Font;
using FontStyle = System.Drawing.FontStyle;
using Size = System.Drawing.Size;

namespace BIMXSmartTools
{
    [Transaction(TransactionMode.Manual)]
    public class MarketingAreaSyncCommand : IExternalCommand
    {
        public const string MAIN_LIVING_TYPE_NAME = "საცხოვრებელი ჯგუფი (სც)";
        public const string MARKETING_BLUE_TYPE_NAME = "Marketing Blue";
        public const string MARKETING_GREEN_TYPE_NAME = "Marketing green";
        public const string ROOM_INVISIBLE_TYPE_NAME = "INVISIBLE";

        public const string ANNOTATION_FAMILY_NAME = "ROOM";
        public const string ANNOTATION_TYPE_NAME = "Marketing Schedule_Archi";

        // ---- პარამეტრები, რომლებიც საჭიროების შემთხვევაში შეიძლება დაკორექტირდეს ----
        private const double FT2_TO_M2 = 0.09290304;      // ft² -> მ²
        private const double WALL_END_TOLERANCE_FT = 1.5;  // კედლის ბოლო რამდენით შეიძლება არ მიდიოდეს კონტურამდე (~45 სმ)
        private const double MIN_SPLIT_PIECE_SQM = 0.3;    // ამაზე პატარა ნაჭრებს დაყოფისას არ ვქმნით
        private const double MIN_LABEL_ROOM_SQM = 0.8;     // ამაზე პატარა ნაჭერს ფართის წარწერა არ ეწერება
        private const int AREA_DECIMALS = 1;               // ოთახის ფართის თანრიგი (13.9 მ²)
        private const double MIN_SEGMENT_FT = 0.01;        // ამაზე მოკლე სეგმენტები კონტურიდან იშლება

        public Result Execute(ExternalCommandData commandData, ref string message, ElementSet elements)
        {
            UIDocument uidoc = commandData.Application.ActiveUIDocument;
            Document doc = uidoc.Document;

            ViewPlan detectedPlan = DetectActivePlan(doc);

            var allFloorViews = new FilteredElementCollector(doc)
                .OfClass(typeof(ViewPlan))
                .Cast<ViewPlan>()
                .Where(v => !v.IsTemplate && v.ViewType != ViewType.CeilingPlan)
                .OrderBy(v => v.Name)
                .ToList();

            if (allFloorViews.Count == 0)
            {
                TaskDialog.Show("M AREA", "პროექტში სართულის გეგმები ვერ მოიძებნა.");
                return Result.Cancelled;
            }

            if (detectedPlan == null)
            {
                detectedPlan = allFloorViews.FirstOrDefault(v => v.Name.Contains("5 სართული")) ?? allFloorViews.First();
            }

            var allRegionTypes = new FilteredElementCollector(doc)
                .OfClass(typeof(FilledRegionType))
                .Cast<FilledRegionType>()
                .ToList();

            FilledRegionType FindType(string name) =>
                allRegionTypes.FirstOrDefault(t => t.Name.Equals(name, StringComparison.OrdinalIgnoreCase));

            var mainLivingType = FindType(MAIN_LIVING_TYPE_NAME);
            var blueType = FindType(MARKETING_BLUE_TYPE_NAME);
            var greenType = FindType(MARKETING_GREEN_TYPE_NAME);
            var invisibleType = FindType(ROOM_INVISIBLE_TYPE_NAME);

            using (MarketingAreaForm form = new MarketingAreaForm(allFloorViews, detectedPlan))
            {
                if (form.ShowDialog() != DialogResult.OK)
                    return Result.Cancelled;

                if (!form.ActionGenerateMarketingRegions && !form.ActionCreateRoomRegions)
                {
                    TaskDialog.Show("M AREA", "არცერთი მოქმედება არ არის მონიშნული.");
                    return Result.Cancelled;
                }

                // საჭირო ფილის ტიპების შემოწმება (ჩუმად არაფრის გაკეთების ნაცვლად)
                var missing = new List<string>();
                if (mainLivingType == null) missing.Add(MAIN_LIVING_TYPE_NAME);
                if (form.ActionGenerateMarketingRegions)
                {
                    if (blueType == null) missing.Add(MARKETING_BLUE_TYPE_NAME);
                    if (greenType == null) missing.Add(MARKETING_GREEN_TYPE_NAME);
                }
                if (form.ActionCreateRoomRegions && invisibleType == null) missing.Add(ROOM_INVISIBLE_TYPE_NAME);

                if (missing.Count > 0)
                {
                    TaskDialog.Show("შეცდომა",
                        "პროექტში ვერ მოიძებნა Filled Region ტიპ(ებ)ი:\n• " + string.Join("\n• ", missing));
                    return Result.Failed;
                }

                using (Transaction t = new Transaction(doc, "BIM X - M AREA Marketing & Rooms"))
                {
                    FailureHandlingOptions failureOptions = t.GetFailureHandlingOptions();
                    failureOptions.SetFailuresPreprocessor(new WarningSwallower());
                    t.SetFailureHandlingOptions(failureOptions);

                    t.Start();
                    try
                    {
                        ViewPlan sourcePlan = form.SelectedSourcePlanView;
                        ViewPlan targetPlan = form.SelectedTargetMarketingView;

                        // 1. ახალი მარკეტინგის გეგმის შექმნა (შტამპები და დეტალები გადმოდის)
                        if (form.CreateNewMarketingView)
                        {
                            ElementId newViewId = sourcePlan.Duplicate(ViewDuplicateOption.WithDetailing);
                            targetPlan = doc.GetElement(newViewId) as ViewPlan;
                            if (targetPlan != null)
                                targetPlan.Name = MakeUniqueViewName(doc, sourcePlan.Name + " მარკეტინგი");
                            doc.Regenerate();
                        }

                        if (targetPlan == null)
                        {
                            t.RollBack();
                            TaskDialog.Show("შეცდომა", "სამიზნე გეგმა ვერ მოიძებნა.");
                            return Result.Failed;
                        }

                        var log = new RunLog();

                        // 2. ბინების (ყვითელი ფილების) წაკითხვა და შტამპებთან დაკავშირება
                        List<ApartmentItem> apartments = CollectApartments(doc, targetPlan, mainLivingType, log);
                        List<StampInfo> stamps = ReadStamps(doc, targetPlan);
                        AssignStamps(apartments, stamps);

                        // ნუმერაციის მიხედვით დალაგება (ფერები მონაცვლეობით დაჯდება)
                        apartments = apartments
                            .OrderBy(a => a.Number > 0 ? 0 : 1)
                            .ThenBy(a => a.Number)
                            .ThenByDescending(a => Math.Round(a.Centroid.Y, 1))
                            .ThenBy(a => a.Centroid.X)
                            .ToList();

                        // 3. კედლები (მხოლოდ სწორი, ხაზოვანი კედლები)
                        List<WallSeg> wallSegs = form.ActionCreateRoomRegions ? ReadWallSegments(doc, targetPlan) : new List<WallSeg>();

                        TextNoteType textType = null;
                        double textHeight = 0.0;
                        if (form.ActionWriteRoomAreaText)
                        {
                            textType = new FilteredElementCollector(doc).OfClass(typeof(TextNoteType)).Cast<TextNoteType>().FirstOrDefault();
                            if (textType != null)
                            {
                                Parameter sizeP = textType.get_Parameter(BuiltInParameter.TEXT_SIZE);
                                if (sizeP != null) textHeight = sizeP.AsDouble() * targetPlan.Scale;
                            }
                            else log.Warn("TextNoteType ვერ მოიძებნა - ფართის წარწერა გამოტოვებულია.");
                        }

                        int mktCount = 0, roomRegionCount = 0, labelCount = 0, aptWithRooms = 0, aptWithoutStamp = 0;
                        var yellowToHide = new HashSet<ElementId>();
                        var yellowToDelete = new HashSet<ElementId>();
                        bool colorToggle = false;

                        foreach (ApartmentItem apt in apartments)
                        {
                            string aptName = apt.Number > 0 ? "ბინა " + apt.Number : "ბინა (ნომრის გარეშე)";
                            if (apt.Stamp == null) aptWithoutStamp++;

                            // 🎨 მთლიანი მარკეტინგის ფილა (კენტი = Blue, ლუწი = Green)
                            if (form.ActionGenerateMarketingRegions)
                            {
                                bool useBlue;
                                if (apt.Number > 0) useBlue = apt.Number % 2 != 0;
                                else { useBlue = !colorToggle; colorToggle = !colorToggle; }

                                try
                                {
                                    FilledRegion.Create(doc, (useBlue ? blueType : greenType).Id, targetPlan.Id,
                                        new List<CurveLoop> { apt.OuterLoop });
                                    mktCount++;

                                    if (apt.SourceRegion.GroupId != ElementId.InvalidElementId)
                                        yellowToHide.Add(apt.SourceRegion.Id);
                                    else
                                        yellowToDelete.Add(apt.SourceRegion.Id);
                                }
                                catch (Exception ex)
                                {
                                    log.Warn(aptName + ": მარკეტინგის ფილა ვერ შეიქმნა - " + ex.Message);
                                }
                            }

                            // 📐 ოთახებად დაყოფა + INVISIBLE ფილები + ფართის წარწერა
                            if (form.ActionCreateRoomRegions)
                            {
                                List<List<V2>> pieces = Geo.Partition(
                                    apt.Polygon,
                                    wallSegs.Where(w => w.Overlaps(apt.MinX, apt.MinY, apt.MaxX, apt.MaxY, WALL_END_TOLERANCE_FT)).ToList(),
                                    WALL_END_TOLERANCE_FT,
                                    MIN_SPLIT_PIECE_SQM / FT2_TO_M2);

                                var rooms = new List<RoomPiece>();
                                foreach (var piece in pieces)
                                {
                                    List<V2> clean = Geo.Clean(piece, MIN_SEGMENT_FT, 0.002);
                                    if (clean.Count < 3) continue;
                                    double a = Math.Abs(Geo.SignedArea(clean));
                                    if (a < 1e-6) continue;
                                    rooms.Add(new RoomPiece
                                    {
                                        Polygon = clean,
                                        AreaSqM = a * FT2_TO_M2,
                                        LabelPoint = Geo.LabelPoint(clean)
                                    });
                                }

                                if (rooms.Count == 0)
                                {
                                    log.Warn(aptName + ": ოთახებად დაყოფა ვერ მოხერხდა.");
                                    continue;
                                }

                                rooms = rooms.OrderByDescending(r => Math.Round(r.LabelPoint.Y, 1)).ThenBy(r => r.LabelPoint.X).ToList();

                                // ფართების დაზუსტება: ჯამი უნდა უდრიდეს შტამპის x1-ს, დამრგვალებით
                                var labeled = rooms.Where(r => r.AreaSqM >= MIN_LABEL_ROOM_SQM).ToList();
                                if (labeled.Count > 0)
                                {
                                    double targetSqM = apt.Stamp != null && apt.StampAreaSqM > 0 ? apt.StampAreaSqM : 0.0;
                                    AllocateAreas(labeled, targetSqM, AREA_DECIMALS, aptName, log);
                                }

                                foreach (RoomPiece rm in rooms)
                                {
                                    try
                                    {
                                        FilledRegion.Create(doc, invisibleType.Id, targetPlan.Id,
                                            new List<CurveLoop> { Geo.ToCurveLoop(rm.Polygon, apt.Z) });
                                        roomRegionCount++;
                                    }
                                    catch (Exception ex)
                                    {
                                        log.Warn(aptName + ": ოთახის ფილა ვერ შეიქმნა - " + ex.Message);
                                    }

                                    if (textType != null && rm.DisplayAreaSqM > 0)
                                    {
                                        try
                                        {
                                            var tOpt = new TextNoteOptions(textType.Id)
                                            {
                                                HorizontalAlignment = HorizontalTextAlignment.Center
                                            };
                                            string text = rm.DisplayAreaSqM.ToString("F" + AREA_DECIMALS, CultureInfo.InvariantCulture) + " მ²";
                                            // ტექსტი ჩამოეკიდება ჩასმის წერტილიდან, ამიტომ ნახევარი სიმაღლით ვწევთ ზევით
                                            XYZ pos = new XYZ(rm.LabelPoint.X, rm.LabelPoint.Y + textHeight * 0.5, apt.Z);
                                            TextNote.Create(doc, targetPlan.Id, pos, text, tOpt);
                                            labelCount++;
                                        }
                                        catch (Exception ex)
                                        {
                                            log.Warn(aptName + ": ფართის წარწერა ვერ შეიქმნა - " + ex.Message);
                                        }
                                    }
                                }
                                aptWithRooms++;
                            }
                        }

                        // ძველი ყვითელი ფილების დამალვა / წაშლა (ერთხელ, ბოლოს)
                        if (yellowToHide.Count > 0)
                        {
                            try { targetPlan.HideElements(yellowToHide.ToList()); }
                            catch (Exception ex) { log.Warn("ჯგუფში მყოფი ყვითელი ფილები ვერ დაიმალა - " + ex.Message); }
                        }
                        if (yellowToDelete.Count > 0)
                        {
                            try { doc.Delete(yellowToDelete.ToList()); }
                            catch (Exception ex) { log.Warn("ძველი ყვითელი ფილები ვერ წაიშალა - " + ex.Message); }
                        }

                        doc.Regenerate();
                        t.Commit();

                        try { uidoc.ActiveView = targetPlan; } catch { }

                        var sb = new StringBuilder();
                        sb.AppendLine("მარკეტინგის გეგმა მომზადდა!");
                        if (form.CreateNewMarketingView) sb.AppendLine("• ახალი გეგმა: " + targetPlan.Name);
                        sb.AppendLine("• ნაპოვნი ბინები: " + apartments.Count + (aptWithoutStamp > 0 ? " (შტამპის გარეშე: " + aptWithoutStamp + ")" : ""));
                        sb.AppendLine("• მარკეტინგის ფილა (Blue/Green): " + mktCount);
                        sb.AppendLine("• ოთახის INVISIBLE ფილა: " + roomRegionCount + " (" + aptWithRooms + " ბინაში)");
                        sb.AppendLine("• ფართის წარწერა: " + labelCount);
                        if (log.Warnings.Count > 0)
                        {
                            sb.AppendLine();
                            sb.AppendLine("გაფრთხილებები (" + log.Warnings.Count + "):");
                            foreach (var w in log.Warnings.Take(8)) sb.AppendLine(" - " + w);
                            if (log.Warnings.Count > 8) sb.AppendLine(" ...");
                        }
                        TaskDialog.Show("M AREA", sb.ToString());
                    }
                    catch (Exception ex)
                    {
                        t.RollBack();
                        TaskDialog.Show("შეცდომა", "ოპერაცია ვერ შესრულდა: " + ex.Message);
                        return Result.Failed;
                    }
                }
            }

            return Result.Succeeded;
        }

        // =========================================================================
        // აქტიური გეგმის განსაზღვრა (გეგმა ან ფურცელზე არსებული პირველი გეგმა)
        // =========================================================================
        private static ViewPlan DetectActivePlan(Document doc)
        {
            View activeView = doc.ActiveView;

            if (activeView is ViewPlan vp && !vp.IsTemplate && vp.ViewType != ViewType.CeilingPlan)
                return vp;

            if (activeView is ViewSheet sheet)
            {
                foreach (var vpId in sheet.GetAllViewports())
                {
                    if (doc.GetElement(vpId) is Viewport vport &&
                        doc.GetElement(vport.ViewId) is ViewPlan innerPlan &&
                        !innerPlan.IsTemplate && innerPlan.ViewType != ViewType.CeilingPlan)
                    {
                        return innerPlan;
                    }
                }
            }
            return null;
        }

        private static string MakeUniqueViewName(Document doc, string baseName)
        {
            var existing = new HashSet<string>(
                new FilteredElementCollector(doc).OfClass(typeof(ViewPlan)).Cast<ViewPlan>().Select(v => v.Name),
                StringComparer.OrdinalIgnoreCase);

            string finalName = baseName;
            int counter = 1;
            while (existing.Contains(finalName)) finalName = baseName + " (" + counter++ + ")";
            return finalName;
        }

        // =========================================================================
        // ბინები: ყვითელი ფილების გარე კონტურები
        // =========================================================================
        private List<ApartmentItem> CollectApartments(Document doc, ViewPlan view, FilledRegionType livingType, RunLog log)
        {
            var result = new List<ApartmentItem>();

            var regions = new FilteredElementCollector(doc, view.Id)
                .OfClass(typeof(FilledRegion))
                .Cast<FilledRegion>()
                .Where(r => r.GetTypeId() == livingType.Id)
                .ToList();

            foreach (FilledRegion region in regions)
            {
                IList<CurveLoop> loops;
                try { loops = region.GetBoundaries(); }
                catch { continue; }
                if (loops == null || loops.Count == 0) continue;

                var items = new List<LoopInfo>();
                foreach (CurveLoop loop in loops)
                {
                    double z;
                    List<V2> poly = Geo.LoopToPolygon(loop, MIN_SEGMENT_FT, out z);
                    if (poly.Count < 3) continue;
                    double sa = Geo.SignedArea(poly);
                    if (Math.Abs(sa) < 1e-6) continue;
                    if (sa < 0) poly.Reverse(); // ყველა პოლიგონი CCW
                    items.Add(new LoopInfo { Loop = loop, Polygon = poly, Z = z, Area = Math.Abs(sa) });
                }

                // გარე კონტურები = ის კონტურები, რომლებიც სხვა (უფრო დიდ) კონტურშივე არ ძევს; შიდა კონტურები (ნახვრეტები) გამოიტოვება
                foreach (LoopInfo li in items)
                {
                    V2 probe = Geo.LabelPoint(li.Polygon);
                    bool isHole = items.Any(o => o != li && o.Area > li.Area && Geo.PointInPolygon(probe, o.Polygon));
                    if (isHole) continue;

                    var apt = new ApartmentItem
                    {
                        SourceRegion = region,
                        OuterLoop = li.Loop,
                        Polygon = li.Polygon,
                        Z = li.Z,
                        Centroid = Geo.Centroid(li.Polygon)
                    };
                    apt.MinX = li.Polygon.Min(p => p.X);
                    apt.MaxX = li.Polygon.Max(p => p.X);
                    apt.MinY = li.Polygon.Min(p => p.Y);
                    apt.MaxY = li.Polygon.Max(p => p.Y);
                    apt.OwnAreaSqM = li.Area * FT2_TO_M2;
                    result.Add(apt);
                }
            }

            if (result.Count == 0)
                log.Warn("ბინის ფილა (" + MAIN_LIVING_TYPE_NAME + ") არჩეულ გეგმაზე ვერ მოიძებნა.");

            return result;
        }

        // =========================================================================
        // შტამპები (Generic Annotation: ROOM) - t1 = ბინის ნომერი, x1 = შიდა ფართი
        // =========================================================================
        private List<StampInfo> ReadStamps(Document doc, ViewPlan view)
        {
            var list = new List<StampInfo>();

            var instances = new FilteredElementCollector(doc, view.Id)
                .OfClass(typeof(FamilyInstance))
                .OfCategory(BuiltInCategory.OST_GenericAnnotation)
                .Cast<FamilyInstance>()
                .Where(fi => fi.Symbol != null && fi.Symbol.Family != null &&
                             fi.Symbol.Family.Name.Equals(ANNOTATION_FAMILY_NAME, StringComparison.OrdinalIgnoreCase));

            foreach (FamilyInstance fi in instances)
            {
                LocationPoint lp = fi.Location as LocationPoint;
                if (lp == null) continue;

                var info = new StampInfo { Point = new V2(lp.Point.X, lp.Point.Y) };

                Parameter pT1 = fi.LookupParameter("t1");
                if (pT1 != null)
                {
                    string s = pT1.AsString() ?? pT1.AsValueString() ?? "";
                    Match m = Regex.Match(s, @"\d+");
                    if (m.Success) int.TryParse(m.Value, out info.Number);
                }

                info.AreaSqM = ReadAreaSqM(fi.LookupParameter("x1"));
                list.Add(info);
            }
            return list;
        }

        // "45.37 მ²", "45,37 m²" ან რიცხვითი პარამეტრი -> მ²  (ქართული/ევროპული მძიმით დამწერლობაც იკითხება)
        private static double ReadAreaSqM(Parameter p)
        {
            if (p == null) return 0.0;

            string s = p.StorageType == StorageType.String ? p.AsString() : p.AsValueString();
            if (!string.IsNullOrWhiteSpace(s))
            {
                Match m = Regex.Match(s, @"\d+(?:[.,]\d+)?");
                double v;
                if (m.Success && double.TryParse(m.Value.Replace(',', '.'), NumberStyles.Float, CultureInfo.InvariantCulture, out v) && v > 0)
                    return v;
            }

            if (p.StorageType == StorageType.Double) return p.AsDouble() * FT2_TO_M2;
            return 0.0;
        }

        // თითო შტამპი ენიჭება მხოლოდ ერთ ბინას: ჯერ კონტურის შიგნით მყოფი, შემდეგ უახლოესი
        private static void AssignStamps(List<ApartmentItem> apartments, List<StampInfo> stamps)
        {
            foreach (ApartmentItem apt in apartments)
            {
                StampInfo best = stamps
                    .Where(s => !s.Used && Geo.PointInPolygon(s.Point, apt.Polygon))
                    .OrderBy(s => s.Point.DistanceTo(apt.Centroid))
                    .FirstOrDefault();
                if (best != null) Attach(apt, best);
            }

            foreach (ApartmentItem apt in apartments.Where(a => a.Stamp == null))
            {
                double diag = Math.Sqrt((apt.MaxX - apt.MinX) * (apt.MaxX - apt.MinX) + (apt.MaxY - apt.MinY) * (apt.MaxY - apt.MinY));
                StampInfo best = stamps
                    .Where(s => !s.Used && s.Point.DistanceTo(apt.Centroid) <= diag * 0.75)
                    .OrderBy(s => s.Point.DistanceTo(apt.Centroid))
                    .FirstOrDefault();
                if (best != null) Attach(apt, best);
            }
        }

        private static void Attach(ApartmentItem apt, StampInfo stamp)
        {
            stamp.Used = true;
            apt.Stamp = stamp;
            apt.Number = stamp.Number;
            apt.StampAreaSqM = stamp.AreaSqM;
        }

        // =========================================================================
        // კედლები: ცენტრალური ღერძები (მხოლოდ სწორხაზოვანი)
        // =========================================================================
        private static List<WallSeg> ReadWallSegments(Document doc, ViewPlan view)
        {
            var list = new List<WallSeg>();
            var walls = new FilteredElementCollector(doc, view.Id).OfClass(typeof(Wall)).Cast<Wall>();

            foreach (Wall w in walls)
            {
                WallType wt = w.WallType;
                if (wt != null && wt.Kind == WallKind.Curtain) continue;

                LocationCurve lc = w.Location as LocationCurve;
                Line line = lc != null ? lc.Curve as Line : null;
                if (line == null) continue;

                XYZ p0 = line.GetEndPoint(0);
                XYZ p1 = line.GetEndPoint(1);
                list.Add(new WallSeg(new V2(p0.X, p0.Y), new V2(p1.X, p1.Y)));
            }
            return list;
        }

        // =========================================================================
        // ფართების განაწილება: ჯამი = შტამპის x1 (ან ბინის კონტურის ფართი), დამრგვალება
        // "უდიდესი ნაშთის" მეთოდით, რომ დამრგვალებული ოთახების ჯამი ზუსტად ემთხვეოდეს
        // =========================================================================
        private static void AllocateAreas(List<RoomPiece> rooms, double targetSqM, int decimals, string aptName, RunLog log)
        {
            double sum = rooms.Sum(r => r.AreaSqM);
            if (sum <= 0) return;

            if (targetSqM > 0)
            {
                // კონტური კედლების ღერძებით იყოფა, ამიტომ გეომეტრიული ჯამი ჩვეულებრივ ≥ წმინდა ფართზე
                double ratio = targetSqM / sum;
                if (ratio >= 0.5 && ratio <= 1.2)
                {
                    foreach (var r in rooms) r.AreaSqM *= ratio;
                }
                else
                {
                    log.Warn(aptName + ": შტამპის ფართი (" + targetSqM.ToString("0.00", CultureInfo.InvariantCulture) +
                             ") და გეომეტრიული ფართი (" + sum.ToString("0.00", CultureInfo.InvariantCulture) +
                             ") მკვეთრად განსხვავდება - გამოყენებულია გეომეტრიული.");
                }
            }

            double unit = Math.Pow(10, decimals);
            double totalUnitsExact = rooms.Sum(r => r.AreaSqM) * unit;
            long totalUnits = (long)Math.Round(totalUnitsExact, MidpointRounding.AwayFromZero);

            var floors = rooms.Select(r => (long)Math.Floor(r.AreaSqM * unit)).ToList();
            long remaining = totalUnits - floors.Sum();

            var order = Enumerable.Range(0, rooms.Count)
                .OrderByDescending(i => rooms[i].AreaSqM * unit - floors[i])
                .ToList();

            for (int k = 0; k < order.Count && remaining > 0; k++, remaining--)
                floors[order[k]]++;

            for (int i = 0; i < rooms.Count; i++)
                rooms[i].DisplayAreaSqM = floors[i] / unit;
        }

        private class WarningSwallower : IFailuresPreprocessor
        {
            public FailureProcessingResult PreprocessFailures(FailuresAccessor failuresAccessor)
            {
                var failureList = failuresAccessor.GetFailureMessages();
                foreach (var failure in failureList)
                {
                    if (failure.GetSeverity() == FailureSeverity.Warning)
                    {
                        failuresAccessor.DeleteWarning(failure);
                    }
                }
                return FailureProcessingResult.Continue;
            }
        }
    }

    // =========================================================================
    // მონაცემთა კლასები
    // =========================================================================
    internal class RunLog
    {
        public List<string> Warnings = new List<string>();
        public void Warn(string s) { Warnings.Add(s); }
    }

    internal class LoopInfo
    {
        public CurveLoop Loop;
        public List<V2> Polygon;
        public double Z;
        public double Area;
    }

    internal class StampInfo
    {
        public V2 Point;
        public int Number;
        public double AreaSqM;
        public bool Used;
    }

    internal class ApartmentItem
    {
        public FilledRegion SourceRegion;
        public CurveLoop OuterLoop;
        public List<V2> Polygon;
        public double Z;
        public V2 Centroid;
        public double MinX, MinY, MaxX, MaxY;
        public double OwnAreaSqM;
        public StampInfo Stamp;
        public int Number;
        public double StampAreaSqM;
    }

    internal class RoomPiece
    {
        public List<V2> Polygon;
        public double AreaSqM;          // გეომეტრიული / დაზუსტებული
        public double DisplayAreaSqM;   // დამრგვალებული, წარწერისთვის (0 = წარწერა არ იწერება)
        public V2 LabelPoint;
    }

    internal struct V2
    {
        public double X, Y;
        public V2(double x, double y) { X = x; Y = y; }
        public double DistanceTo(V2 o) { double dx = X - o.X, dy = Y - o.Y; return Math.Sqrt(dx * dx + dy * dy); }
    }

    internal class WallSeg
    {
        public V2 A, B;
        public WallSeg(V2 a, V2 b) { A = a; B = b; }

        public bool Overlaps(double minX, double minY, double maxX, double maxY, double pad)
        {
            return Math.Max(A.X, B.X) >= minX - pad && Math.Min(A.X, B.X) <= maxX + pad &&
                   Math.Max(A.Y, B.Y) >= minY - pad && Math.Min(A.Y, B.Y) <= maxY + pad;
        }
    }

    // =========================================================================
    // 2D გეომეტრია (Revit-ისგან დამოუკიდებელი)
    // =========================================================================
    internal static class Geo
    {
        private const double Eps = 1e-6;

        private struct Node { public V2 P; public bool OnLine; }
        private struct Cut { public double S; public int Index; }

        public static double SignedArea(IList<V2> p)
        {
            double s = 0.0;
            for (int i = 0; i < p.Count; i++)
            {
                V2 a = p[i], b = p[(i + 1) % p.Count];
                s += a.X * b.Y - b.X * a.Y;
            }
            return s * 0.5;
        }

        public static V2 Centroid(IList<V2> p)
        {
            double a = SignedArea(p);
            if (Math.Abs(a) < 1e-12)
                return new V2(p.Average(q => q.X), p.Average(q => q.Y));

            double cx = 0.0, cy = 0.0;
            for (int i = 0; i < p.Count; i++)
            {
                V2 u = p[i], v = p[(i + 1) % p.Count];
                double cr = u.X * v.Y - v.X * u.Y;
                cx += (u.X + v.X) * cr;
                cy += (u.Y + v.Y) * cr;
            }
            return new V2(cx / (6.0 * a), cy / (6.0 * a));
        }

        public static bool PointInPolygon(V2 pt, IList<V2> poly)
        {
            bool inside = false;
            for (int i = 0, j = poly.Count - 1; i < poly.Count; j = i++)
            {
                V2 pi = poly[i], pj = poly[j];
                if ((pi.Y > pt.Y) != (pj.Y > pt.Y) &&
                    pt.X < (pj.X - pi.X) * (pt.Y - pi.Y) / (pj.Y - pi.Y) + pi.X)
                    inside = !inside;
            }
            return inside;
        }

        private static double DistToSegment(V2 p, V2 a, V2 b)
        {
            double dx = b.X - a.X, dy = b.Y - a.Y;
            double l2 = dx * dx + dy * dy;
            double t = l2 < 1e-18 ? 0.0 : Math.Max(0.0, Math.Min(1.0, ((p.X - a.X) * dx + (p.Y - a.Y) * dy) / l2));
            double ex = p.X - (a.X + t * dx), ey = p.Y - (a.Y + t * dy);
            return Math.Sqrt(ex * ex + ey * ey);
        }

        private static double DistToPolygon(V2 p, IList<V2> poly)
        {
            double d = double.MaxValue;
            for (int i = 0; i < poly.Count; i++)
                d = Math.Min(d, DistToSegment(p, poly[i], poly[(i + 1) % poly.Count]));
            return d;
        }

        // წერტილი ოთახის შიგნით წარწერისთვის: ცენტროიდი, ხოლო არაამოზნექილ ფორმაში - ყველაზე განიერი ჰორიზონტალური მონაკვეთის შუა
        public static V2 LabelPoint(IList<V2> poly)
        {
            V2 c = Centroid(poly);
            if (PointInPolygon(c, poly) && DistToPolygon(c, poly) > 1e-3) return c;

            var xs = new List<double>();
            for (int i = 0; i < poly.Count; i++)
            {
                V2 a = poly[i], b = poly[(i + 1) % poly.Count];
                if ((a.Y > c.Y) != (b.Y > c.Y))
                    xs.Add(a.X + (c.Y - a.Y) / (b.Y - a.Y) * (b.X - a.X));
            }
            xs.Sort();

            double bestW = -1.0;
            V2 best = new V2(poly.Average(q => q.X), poly.Average(q => q.Y));
            for (int k = 0; k + 1 < xs.Count; k += 2)
            {
                double w = xs[k + 1] - xs[k];
                if (w > bestW) { bestW = w; best = new V2((xs[k] + xs[k + 1]) * 0.5, c.Y); }
            }
            return best;
        }

        // მეზობელი დუბლირებული და კოლინეარული წვეროების მოშორება
        public static List<V2> Clean(IList<V2> pts, double minLen, double collinearTol)
        {
            var p = new List<V2>(pts);
            bool changed = true;
            int guard = 0;
            while (changed && p.Count >= 3 && guard++ < 1000)
            {
                changed = false;
                for (int i = 0; i < p.Count; i++)
                {
                    V2 prev = p[(i + p.Count - 1) % p.Count];
                    V2 cur = p[i];
                    V2 next = p[(i + 1) % p.Count];

                    if (cur.DistanceTo(prev) < minLen || DistToSegment(cur, prev, next) < collinearTol)
                    {
                        p.RemoveAt(i);
                        changed = true;
                        break;
                    }
                }
            }
            return p;
        }

        // CurveLoop -> პოლიგონი (რკალები იყოფა მონაკვეთებად)
        public static List<V2> LoopToPolygon(CurveLoop loop, double minLen, out double z)
        {
            var pts = new List<V2>();
            z = 0.0;
            bool zSet = false;

            foreach (Curve c in loop)
            {
                IList<XYZ> tess = c.Tessellate();
                if (tess == null || tess.Count < 2) continue;
                if (!zSet) { z = tess[0].Z; zSet = true; }

                var seg = tess.Select(q => new V2(q.X, q.Y)).ToList();
                if (pts.Count > 0 && pts[pts.Count - 1].DistanceTo(seg[0]) > pts[pts.Count - 1].DistanceTo(seg[seg.Count - 1]))
                    seg.Reverse();

                int start = pts.Count == 0 ? 0 : 1;
                for (int i = start; i < seg.Count; i++) pts.Add(seg[i]);
            }

            if (pts.Count > 1 && pts[0].DistanceTo(pts[pts.Count - 1]) < minLen)
                pts.RemoveAt(pts.Count - 1);

            return Clean(pts, minLen, 1e-4);
        }

        public static CurveLoop ToCurveLoop(IList<V2> poly, double z)
        {
            var loop = new CurveLoop();
            for (int i = 0; i < poly.Count; i++)
            {
                V2 a = poly[i], b = poly[(i + 1) % poly.Count];
                loop.Append(Line.CreateBound(new XYZ(a.X, a.Y, z), new XYZ(b.X, b.Y, z)));
            }
            return loop;
        }

        // =====================================================================
        // პოლიგონის დაყოფა კედლებით: კედელი პოლიგონს ჰყოფს მხოლოდ მაშინ, თუ მისი ხაზი
        // პოლიგონს კონტურიდან კონტურამდე (ან უკვე გაჭრილ ხაზამდე) მთლიანად კვეთს
        // =====================================================================
        public static List<List<V2>> Partition(List<V2> poly, List<WallSeg> walls, double endTol, double minPieceArea)
        {
            var work = new Stack<List<V2>>();
            work.Push(poly);
            var result = new List<List<V2>>();
            int guard = 0;

            while (work.Count > 0 && guard++ < 2000)
            {
                List<V2> p = work.Pop();
                bool split = false;

                foreach (WallSeg w in walls)
                {
                    List<V2> p1, p2;
                    if (TrySplit(p, w.A, w.B, endTol, 0.3, minPieceArea, out p1, out p2))
                    {
                        work.Push(p1);
                        work.Push(p2);
                        split = true;
                        break;
                    }
                }
                if (!split) result.Add(p);
            }
            return result;
        }

        private static bool TrySplit(List<V2> poly, V2 a, V2 b, double endTol, double minChord, double minPieceArea,
                                     out List<V2> p1, out List<V2> p2)
        {
            p1 = null; p2 = null;

            double dx = b.X - a.X, dy = b.Y - a.Y;
            double len = Math.Sqrt(dx * dx + dy * dy);
            if (len < 1e-6) return false;

            double ux = dx / len, uy = dy / len;     // ხაზის მიმართულება
            double nx = -uy, ny = ux;                // ნორმალი

            int n = poly.Count;
            var dist = new double[n];
            var sign = new int[n];
            for (int i = 0; i < n; i++)
            {
                dist[i] = (poly[i].X - a.X) * nx + (poly[i].Y - a.Y) * ny;
                sign[i] = Math.Abs(dist[i]) < Eps ? 0 : (dist[i] > 0 ? 1 : -1);
            }

            // წვეროები + ხაზთან გადაკვეთის წერტილები
            var nodes = new List<Node>();
            for (int i = 0; i < n; i++)
            {
                int j = (i + 1) % n;
                nodes.Add(new Node { P = poly[i], OnLine = sign[i] == 0 });
                if (sign[i] * sign[j] < 0)
                {
                    double t = dist[i] / (dist[i] - dist[j]);
                    nodes.Add(new Node
                    {
                        P = new V2(poly[i].X + t * (poly[j].X - poly[i].X), poly[i].Y + t * (poly[j].Y - poly[i].Y)),
                        OnLine = true
                    });
                }
            }

            var cuts = new List<Cut>();
            for (int i = 0; i < nodes.Count; i++)
            {
                if (!nodes[i].OnLine) continue;
                cuts.Add(new Cut { S = (nodes[i].P.X - a.X) * ux + (nodes[i].P.Y - a.Y) * uy, Index = i });
            }
            cuts.Sort((c1, c2) => c1.S.CompareTo(c2.S));

            for (int k = 0; k + 1 < cuts.Count; k++)
            {
                Cut c0 = cuts[k], c1 = cuts[k + 1];

                if (c1.S - c0.S < minChord) continue;                       // ძალიან მოკლე
                if (c0.S < -endTol || c1.S > len + endTol) continue;        // კედელი მთლიანად არ ფარავს მონაკვეთს

                V2 pa = nodes[c0.Index].P, pb = nodes[c1.Index].P;
                V2 mid = new V2((pa.X + pb.X) * 0.5, (pa.Y + pb.Y) * 0.5);
                if (!PointInPolygon(mid, poly) || DistToPolygon(mid, poly) < 1e-3) continue; // მონაკვეთი კონტურის გასწვრივაა / გარეთაა

                int lo = Math.Min(c0.Index, c1.Index), hi = Math.Max(c0.Index, c1.Index);

                var q1 = new List<V2>();
                for (int i = lo; i <= hi; i++) q1.Add(nodes[i].P);

                var q2 = new List<V2>();
                for (int i = hi; i < nodes.Count; i++) q2.Add(nodes[i].P);
                for (int i = 0; i <= lo; i++) q2.Add(nodes[i].P);

                if (q1.Count < 3 || q2.Count < 3) continue;
                if (Math.Abs(SignedArea(q1)) < minPieceArea || Math.Abs(SignedArea(q2)) < minPieceArea) continue;

                p1 = q1; p2 = q2;
                return true;
            }
            return false;
        }
    }

    // =========================================================================
    // 🖥 UI დიალოგი
    // =========================================================================
    public class MarketingAreaForm : Form
    {
        public bool CreateNewMarketingView => rbCreateNewView.Checked;
        public bool ActionGenerateMarketingRegions => chkGenerateMkt.Checked;
        public bool ActionCreateRoomRegions => chkCreateRoomRegions.Checked;
        public bool ActionWriteRoomAreaText => chkCreateRoomRegions.Checked && chkWriteRoomAreaText.Checked;

        public ViewPlan SelectedSourcePlanView => cmbSourceView.SelectedItem as ViewPlan;
        public ViewPlan SelectedTargetMarketingView => rbUseExistingView.Checked ? (cmbTargetView.SelectedItem as ViewPlan) : null;

        private System.Windows.Forms.ComboBox cmbSourceView;
        private System.Windows.Forms.ComboBox cmbTargetView;
        private System.Windows.Forms.RadioButton rbCreateNewView;
        private System.Windows.Forms.RadioButton rbUseExistingView;
        private System.Windows.Forms.CheckBox chkGenerateMkt;
        private System.Windows.Forms.CheckBox chkCreateRoomRegions;
        private System.Windows.Forms.CheckBox chkWriteRoomAreaText;
        private System.Windows.Forms.Button btnExecute;
        private System.Windows.Forms.Button btnCancel;

        public MarketingAreaForm(List<ViewPlan> allFloorViews, ViewPlan detectedPlan)
        {
            this.Text = "BIM X - M AREA (სუფთა მარკეტინგის გეგმა & ოთახები)";
            this.Size = new Size(630, 490);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.MinimizeBox = false;

            int y = 12;

            System.Windows.Forms.Panel infoPnl = new System.Windows.Forms.Panel() { Location = new Point(15, y), Size = new Size(580, 68), BackColor = Color.FromArgb(240, 245, 255), BorderStyle = BorderStyle.FixedSingle };
            infoPnl.Controls.Add(new System.Windows.Forms.Label() { Text = $"✔ ძირითადი ფილა: {MarketingAreaSyncCommand.MAIN_LIVING_TYPE_NAME}\n✔ მარკეტინგის ფილა: {MarketingAreaSyncCommand.MARKETING_BLUE_TYPE_NAME} & {MarketingAreaSyncCommand.MARKETING_GREEN_TYPE_NAME}\n✔ ოთახების ფილა: {MarketingAreaSyncCommand.ROOM_INVISIBLE_TYPE_NAME} | შტამპი: {MarketingAreaSyncCommand.ANNOTATION_FAMILY_NAME}", Location = new Point(10, 6), AutoSize = true, Font = new Font("Arial", 8.5f, FontStyle.Bold), ForeColor = Color.FromArgb(30, 60, 120) });
            this.Controls.Add(infoPnl);

            y += 78;

            this.Controls.Add(new System.Windows.Forms.Label() { Text = "საწყისი გეგმა (ძირითადი ფილებით):", Location = new Point(15, y + 3), AutoSize = true, Font = new Font("Arial", 9f, FontStyle.Bold) });
            cmbSourceView = new System.Windows.Forms.ComboBox() { Location = new Point(285, y), Width = 310, DropDownStyle = ComboBoxStyle.DropDownList, DisplayMember = "Name" };
            foreach (var v in allFloorViews) cmbSourceView.Items.Add(v);
            int srcIdx = allFloorViews.FindIndex(v => v.Id == detectedPlan.Id);
            cmbSourceView.SelectedIndex = srcIdx >= 0 ? srcIdx : 0;
            this.Controls.Add(cmbSourceView);

            y += 36;

            rbCreateNewView = new System.Windows.Forms.RadioButton()
            {
                Text = "✨ ახალი მარკეტინგის გეგმის შექმნა (შტამპების & დეტალების გადმოტანით)",
                Location = new Point(18, y),
                AutoSize = true,
                Font = new Font("Arial", 9.5f, FontStyle.Bold),
                ForeColor = Color.DarkMagenta,
                Checked = true
            };
            rbCreateNewView.CheckedChanged += (s, e) => cmbTargetView.Enabled = rbUseExistingView.Checked;
            this.Controls.Add(rbCreateNewView);

            y += 28;

            rbUseExistingView = new System.Windows.Forms.RadioButton()
            {
                Text = "არსებულ მარკეტინგის გეგმაში გადატანა:",
                Location = new Point(18, y),
                AutoSize = true,
                Font = new Font("Arial", 9f),
                Checked = false
            };
            rbUseExistingView.CheckedChanged += (s, e) => cmbTargetView.Enabled = rbUseExistingView.Checked;
            this.Controls.Add(rbUseExistingView);

            cmbTargetView = new System.Windows.Forms.ComboBox() { Location = new Point(285, y - 2), Width = 310, DropDownStyle = ComboBoxStyle.DropDownList, DisplayMember = "Name", Enabled = false };
            foreach (var v in allFloorViews) cmbTargetView.Items.Add(v);
            int targetIdx = allFloorViews.FindIndex(v => v.Name.ToLower().Contains("მარკეტინგი") || v.Name.ToLower().Contains("marketing"));
            cmbTargetView.SelectedIndex = targetIdx >= 0 ? targetIdx : (srcIdx >= 0 ? srcIdx : 0);
            this.Controls.Add(cmbTargetView);

            y += 40;

            chkGenerateMkt = new System.Windows.Forms.CheckBox()
            {
                Text = "🎨 სრული მარკეტინგის ფილების შექმნა (კენტი=Blue, ლუწი=Green)",
                Location = new Point(20, y),
                AutoSize = true,
                Font = new Font("Arial", 9.5f, FontStyle.Bold),
                ForeColor = Color.DarkBlue,
                Checked = true
            };
            this.Controls.Add(chkGenerateMkt);

            y += 28;

            chkCreateRoomRegions = new System.Windows.Forms.CheckBox()
            {
                Text = "📐 ზემოდან ოთახების INVISIBLE ფილების შექმნა (კედლების მიხედვით დაყოფით)",
                Location = new Point(20, y),
                AutoSize = true,
                Font = new Font("Arial", 9.5f, FontStyle.Bold),
                ForeColor = Color.DarkGreen,
                Checked = true
            };
            chkCreateRoomRegions.CheckedChanged += (s, e) => chkWriteRoomAreaText.Enabled = chkCreateRoomRegions.Checked;
            this.Controls.Add(chkCreateRoomRegions);

            y += 28;

            chkWriteRoomAreaText = new System.Windows.Forms.CheckBox()
            {
                Text = "✍️ ოთახებში მხოლოდ ფართობის დაწერა (მაგ: 13.9 მ²)",
                Location = new Point(20, y),
                AutoSize = true,
                Font = new Font("Arial", 9.5f, FontStyle.Bold),
                ForeColor = Color.DarkSlateGray,
                Checked = true
            };
            this.Controls.Add(chkWriteRoomAreaText);

            y += 45;

            btnExecute = new System.Windows.Forms.Button()
            {
                Text = "⚡ M AREA სინქრონიზაცია და გენერაცია",
                Location = new Point(20, y),
                Size = new Size(390, 44),
                BackColor = Color.LightGreen,
                Font = new Font("Arial", 10f, FontStyle.Bold),
                Cursor = Cursors.Hand,
                DialogResult = DialogResult.OK
            };
            this.Controls.Add(btnExecute);

            btnCancel = new System.Windows.Forms.Button()
            {
                Text = "გაუქმება",
                Location = new Point(425, y),
                Size = new Size(170, 44),
                BackColor = Color.LightGray,
                Font = new Font("Arial", 9.5f),
                Cursor = Cursors.Hand,
                DialogResult = DialogResult.Cancel
            };
            this.Controls.Add(btnCancel);

            this.AcceptButton = btnExecute;
            this.CancelButton = btnCancel;
        }
    }
}
